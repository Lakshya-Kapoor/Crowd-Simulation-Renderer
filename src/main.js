import cdt2d from "https://cdn.jsdelivr.net/npm/cdt2d@1.0.0/+esm";
import Utils from "./utils.js";

class WebGLAPP {
  vertexShaderSource = `
    attribute vec2 a_position;

    uniform mat3 u_matrix;

    void main() {
      gl_Position = vec4((u_matrix * vec3(a_position, 1)).xy, 0, 1);
      gl_PointSize = 6.0;
    }
  `;

  fragmentShaderSource = `
    precision mediump float;

    uniform vec4 u_color;

    void main() {
      gl_FragColor = u_color;
    }
  `;

  createShader(type, source) {
    const shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    const success = this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS);

    if (success) {
      return shader;
    }

    console.log(this.gl.getShaderInfoLog(shader));
    this.gl.deleteShader(shader);
  }

  createProgram(vertexShader, fragmentShader) {
    const program = this.gl.createProgram();
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);
    const success = this.gl.getProgramParameter(program, this.gl.LINK_STATUS);
    if (success) {
      return program;
    }

    console.log(this.gl.getProgramInfoLog(program));
    this.gl.deleteProgram(program);
  }

  initializeAndRender() {
    this.canvas = document.querySelector("canvas");
    this.gl = this.canvas.getContext("webgl");

    this.vertexShader = this.createShader(
      this.gl.VERTEX_SHADER,
      this.vertexShaderSource
    );
    this.fragmentShader = this.createShader(
      this.gl.FRAGMENT_SHADER,
      this.fragmentShaderSource
    );

    this.program = this.createProgram(this.vertexShader, this.fragmentShader);

    this.positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);

    this.positionAttributeLocation = this.gl.getAttribLocation(
      this.program,
      "a_position"
    );
    this.matrixUniformLocation = this.gl.getUniformLocation(
      this.program,
      "u_matrix"
    );
    this.colorUniformLocation = this.gl.getUniformLocation(
      this.program,
      "u_color"
    );

    // Boilerplate to setup canvas
    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
    this.gl.clearColor(0, 0, 0, 0);

    this.gl.useProgram(this.program);

    this.gl.enableVertexAttribArray(this.positionAttributeLocation);
    this.gl.vertexAttribPointer(
      this.positionAttributeLocation,
      2,
      this.gl.FLOAT,
      false,
      0,
      0
    );

    // Setting projection matrix in the vertex shader
    this.gl.uniformMatrix3fv(
      this.matrixUniformLocation,
      false,
      Utils.projectionMatrix(this.gl.canvas.width, this.gl.canvas.height)
    );

    this.obstacleVertices = Utils.getCenteredRect(100, 100, this.gl);
    this.canvasCorners = Utils.getCanvasCorners(this.gl);

    // First 4 vertices are obstacle vertices, Next 4 are canvas corners and rest are random vertices
    this.vertices = Utils.poissonDiskSampling(
      this.canvas.width,
      this.canvas.height,
      120,
      30,
      [...this.obstacleVertices, ...this.canvasCorners]
    );

    // Position of people
    this.peopleVertices = Utils.poissonDiskSampling(
      this.canvas.width,
      this.canvas.height,
      50,
      100
    );

    this.drawScene();
  }

  transformObstacle() {
    this.transformedObstacleVertices = [];

    let transformationMatrix = Utils.multiplyManyMM(
      Utils.translationMatrix(this.canvas.width / 2, this.canvas.height / 2),
      Utils.translationMatrix(this.translate[0], this.translate[1]),
      Utils.rotationMatrix(this.rotate),
      Utils.scalingMatrix(this.scale, this.scale),
      Utils.translationMatrix(-this.canvas.width / 2, -this.canvas.height / 2)
    );

    for (let i = 0; i < this.obstacleVertices.length; i++) {
      const transformedVertex = Utils.multiplyMV(transformationMatrix, [
        ...this.obstacleVertices[i],
        1,
      ]);

      this.transformedObstacleVertices.push(transformedVertex.slice(0, 2));
    }
  }

  drawTriangles() {
    this.triangulatedVertices = [];

    const vertices = this.vertices;

    for (let i = 0; i < this.transformedObstacleVertices.length; i++) {
      vertices[i] = this.transformedObstacleVertices[i];
    }

    const edges = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [0, 2],
    ];

    const triangles = cdt2d(vertices, edges);
    triangles.forEach((arr) => {
      arr.forEach((idx) => {
        this.triangulatedVertices.push(...vertices[idx]);
      });
    });

    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array(this.triangulatedVertices),
      this.gl.STATIC_DRAW
    );

    for (let i = 0; i < this.triangulatedVertices.length; i += 6) {
      const populationDensity = Utils.countPointsInTriangle(
        this.peopleVertices,
        this.triangulatedVertices.slice(i, i + 6)
      );

      const color = [0, 0, 0, 0.4];

      if (populationDensity > this.thresholdDensity) {
        color[0] = 1;
      } else if (populationDensity == this.thresholdDensity) {
        color[1] = 1;
      } else {
        color[2] = 1;
      }

      this.gl.uniform4f(this.colorUniformLocation, ...color);
      this.gl.drawArrays(this.gl.TRIANGLES, i / 2, 3);

      this.gl.uniform4f(this.colorUniformLocation, 0, 0, 0, 1);
      this.gl.drawArrays(this.gl.LINE_LOOP, i / 2, 3);
    }
  }

  drawPeople() {
    const peopleVertices = this.peopleVertices.flat();

    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array(peopleVertices),
      this.gl.DYNAMIC_DRAW
    );

    this.gl.uniform4f(this.colorUniformLocation, 0, 0, 0, 0.6);
    this.gl.drawArrays(this.gl.POINTS, 0, peopleVertices.length / 2);
  }

  drawObstacle() {
    const obstacleVertices = [];

    for (let i = 0; i <= 2; i++) {
      obstacleVertices.push(...this.transformedObstacleVertices[i]);
    }

    for (let i = 2; i <= 4; i++) {
      obstacleVertices.push(...this.transformedObstacleVertices[i % 4]);
    }

    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array(obstacleVertices),
      this.gl.DYNAMIC_DRAW
    );

    this.gl.uniform4f(this.colorUniformLocation, 0, 0, 0, 1);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
  }

  drawScene() {
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    this.transformObstacle();
    this.drawTriangles();
    this.drawPeople();
    this.drawObstacle();
  }

  sliderEventListener() {
    const rangeMapping = {
      translateX: [-this.canvas.width / 2, this.canvas.width / 2],
      translateY: [-this.canvas.height / 2, this.canvas.height / 2],
      scale: [0, 3],
      rotate: [0, 360],
      crowdDensity: [1, 6],
    };

    const stepMapping = {
      translateX: 1,
      translateY: 1,
      scale: 0.1,
      rotate: 0,
      crowdDensity: 1,
    };

    const defaultMapping = {
      translateX: this.translate[0],
      translateY: this.translate[1],
      scale: this.scale,
      rotate: this.rotate * (180 / Math.PI),
      crowdDensity: this.thresholdDensity,
    };

    const functionMapping = {
      translateX: (v) => (this.translate[0] = v),
      translateY: (v) => (this.translate[1] = v),
      scale: (v) => (this.scale = v),
      rotate: (v) => (this.rotate = v * (Math.PI / 180)),
      crowdDensity: (v) => (this.thresholdDensity = v),
    };

    const unitMapping = {
      translateX: "px",
      translateY: "px",
      scale: "x",
      rotate: "°",
      crowdDensity: "",
    };

    // Store slider input and valueDisplay elements for later syncing
    this.sliderElements = {};

    document.querySelectorAll(".slider").forEach((slider) => {
      const input = slider.querySelector("input");
      const valueDisplay = slider.querySelector(".value");

      input.min = rangeMapping[slider.id][0];
      input.max = rangeMapping[slider.id][1];
      input.step = stepMapping[slider.id];
      input.value = defaultMapping[slider.id];

      valueDisplay.textContent =
        defaultMapping[slider.id] + unitMapping[slider.id];

      // Store for later syncing
      this.sliderElements[slider.id] = {
        input,
        valueDisplay,
        unit: unitMapping[slider.id],
      };

      input.addEventListener("input", () => {
        valueDisplay.textContent = input.value + unitMapping[slider.id];
        functionMapping[slider.id](parseFloat(input.value));
        this.drawScene();
      });
    });
  }

  // Helper to sync sliders with internal state
  syncSlidersFromState() {
    if (!this.sliderElements) return;
    if (this.sliderElements.translateX) {
      this.sliderElements.translateX.input.value = this.translate[0];
      this.sliderElements.translateX.valueDisplay.textContent =
        this.translate[0] + this.sliderElements.translateX.unit;
    }
    if (this.sliderElements.translateY) {
      this.sliderElements.translateY.input.value = this.translate[1];
      this.sliderElements.translateY.valueDisplay.textContent =
        this.translate[1] + this.sliderElements.translateY.unit;
    }
    if (this.sliderElements.scale) {
      this.sliderElements.scale.input.value = this.scale;
      this.sliderElements.scale.valueDisplay.textContent =
        this.scale + this.sliderElements.scale.unit;
    }
    if (this.sliderElements.rotate) {
      // Convert radians to degrees for slider
      const deg = Math.round(this.rotate * (180 / Math.PI));
      this.sliderElements.rotate.input.value = deg;
      this.sliderElements.rotate.valueDisplay.textContent =
        deg + this.sliderElements.rotate.unit;
    }
    if (this.sliderElements.crowdDensity) {
      this.sliderElements.crowdDensity.input.value = this.thresholdDensity;
      this.sliderElements.crowdDensity.valueDisplay.textContent =
        this.thresholdDensity + this.sliderElements.crowdDensity.unit;
    }
  }

  canvasEventListener() {
    this.canvas.addEventListener("mousedown", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (
        Utils.isPointInQuadrilateral(this.transformedObstacleVertices, [x, y])
      ) {
        this.selectedObstacle = true;
        this.lastCoord = [x, y];
        this.canvas.style.cursor = "move";
        return;
      }

      for (let i = 0; i < this.peopleVertices.length; i++) {
        const dx = this.peopleVertices[i][0] - x;
        const dy = this.peopleVertices[i][1] - y;

        if (dx * dx + dy * dy < 8 * 8) {
          this.selectedPersonIndex = i;
          this.canvas.style.cursor = "pointer";
          return;
        }
      }
    });

    this.canvas.addEventListener("mousemove", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      let updated = false;
      if (this.selectedPersonIndex !== null) {
        this.peopleVertices[this.selectedPersonIndex] = [x, y];
        updated = true;
      }

      if (this.selectedObstacle) {
        this.translate[0] += x - this.lastCoord[0];
        this.translate[1] += y - this.lastCoord[1];
        this.lastCoord = [x, y];
        updated = true;
      }

      if (updated) {
        this.syncSlidersFromState();
        this.drawScene();
      }
    });

    this.canvas.addEventListener("mouseup", (e) => {
      this.selectedPersonIndex = null;
      this.selectedObstacle = null;
      this.canvas.style.cursor = "default";
    });

    this.canvas.addEventListener(
      "wheel",
      (e) => {
        if (e.deltaY < 0) {
          this.scale = Math.min(this.scale + 0.1, 3);
        } else {
          this.scale = Math.max(this.scale - 0.1, 0.1);
        }
        this.scale = Math.round(this.scale * 10) / 10;
        this.syncSlidersFromState();
        this.drawScene();
      },
      { passive: false }
    );
  }

  constructor() {
    this.translate = [0, 0];
    this.scale = 1;
    this.rotate = 0;
    this.thresholdDensity = 4;

    this.initializeAndRender();
    this.sliderEventListener();
    this.canvasEventListener();
  }
}

const app = new WebGLAPP();
