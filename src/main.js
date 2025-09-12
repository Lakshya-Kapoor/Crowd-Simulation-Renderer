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

  transformObstacle() {
    this.transformedObstacleVertices = [];

    let transformationMatrix = Utils.multiplyManyMM(
      Utils.translationMatrix(this.translate[0], this.translate[1]),
      Utils.translationMatrix(this.canvas.width / 2, this.canvas.height / 2),
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

  initialize() {
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

    this.obstacleVertices = Utils.getCenteredRect(100, 100, this.gl);
    this.canvasCorners = Utils.getCanvasCorners(this.gl);
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
      const populationDensity = Utils.countPointsInsideTriangle(
        this.peopleVertices,
        this.triangulatedVertices.slice(i, i + 6)
      );

      const color = [0, 0, 0, 0.4];

      const densityThreshold = 4;

      if (populationDensity > densityThreshold) {
        color[0] = 1;
      } else if (populationDensity == densityThreshold) {
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

  render() {
    // Boilerplate to setup canvas
    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

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

    this.gl.uniformMatrix3fv(
      this.matrixUniformLocation,
      false,
      Utils.projectionMatrix(this.gl.canvas.width, this.gl.canvas.height)
    );

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

  drawScene() {
    this.transformObstacle();
    this.drawTriangles();
    this.drawPeople();
    this.drawObstacle();
  }

  sliderSetup() {
    const rangeMapping = {
      translateX: [-200, 200],
      translateY: [-200, 200],
      scale: [0, 3],
      rotate: [0, 360],
    };

    const defaultMapping = {
      translateX: 0,
      translateY: 0,
      scale: 1,
      rotate: 0,
    };

    const functionMapping = {
      translateX: (value) => {
        this.translate[0] = value;
      },
      translateY: (value) => {
        this.translate[1] = value;
      },
      scale: (value) => {
        this.scale = value;
      },
      rotate: (value) => {
        this.rotate = value * (Math.PI / 180);
      },
    };

    const stepMapping = {
      translateX: 5,
      translateY: 5,
      scale: 0.1,
      rotate: 0,
    };

    document.querySelectorAll(".slider").forEach((slider) => {
      const input = slider.querySelector("input");
      const valueDisplay = slider.querySelector(".value");

      input.min = rangeMapping[slider.id][0];
      input.max = rangeMapping[slider.id][1];
      input.value = defaultMapping[slider.id];
      input.step = stepMapping[slider.id];

      valueDisplay.textContent = input.value;

      input.addEventListener("input", () => {
        valueDisplay.textContent = input.value;
        functionMapping[slider.id](parseFloat(input.value));
        this.drawScene();
      });
    });
  }

  constructor() {
    this.translate = [0, 0];
    this.scale = 1;
    this.rotate = 0;

    this.initialize();
    this.render();
    this.sliderSetup();
  }
}

const app = new WebGLAPP();
