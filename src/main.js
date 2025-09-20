import cdt2d from "https://cdn.jsdelivr.net/npm/cdt2d@1.0.0/+esm";
import Utils, { Matrix } from "./utils.js";
import Renderer from "./renderer.js";

class App {
  drawScene() {
    this.renderer.clear();
    this.transformObstacle();
    this.drawTriangles();
    this.drawPeople();
    this.drawObstacle();
  }

  transformObstacle() {
    this.transformedObstacleVertices = [];

    let transformationMatrix = Matrix.multiplyManyMM(
      Matrix.translation(this.obstacleCenter[0], this.obstacleCenter[1]),
      Matrix.translation(this.translate[0], this.translate[1]),
      Matrix.rotation(this.rotate),
      Matrix.scaling(this.scale, this.scale),
      Matrix.translation(-this.obstacleCenter[0], -this.obstacleCenter[1])
    );

    for (let i = 0; i < this.obstacleVertices.length; i++) {
      const transformedVertex = Matrix.multiplyMV(transformationMatrix, [
        ...this.obstacleVertices[i],
        1,
      ]);

      this.transformedObstacleVertices.push(transformedVertex.slice(0, 2));
    }
  }

  drawTriangles() {
    const triangulatedVertices = [];

    // Using the transformed obstacle vertices for triangulation
    for (let i = 0; i < this.transformedObstacleVertices.length; i++) {
      this.vertices[i] = this.transformedObstacleVertices[i];
    }

    // Edges of the obstacle to be used as constraints in triangulation
    const edges = [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [0, 2],
    ];

    // Triangulate the vertices with the obstacle edges as constraints
    const triangles = cdt2d(this.vertices, edges);

    // Flatten the triangulated vertices array for rendering
    triangles.forEach((arr) => {
      arr.forEach((idx) => {
        triangulatedVertices.push(...this.vertices[idx]);
      });
    });

    let red = 0,
      green = 0,
      blue = 0;

    this.renderer.setPositionBuffer(triangulatedVertices);

    for (let i = 0; i < triangulatedVertices.length; i += 6) {
      const density = Utils.countPointsInTriangle(
        this.peopleVertices,
        triangulatedVertices.slice(i, i + 6)
      );

      if (this.thresholdDensity > density) {
        blue++;
      } else if (this.thresholdDensity < density) {
        red++;
      } else {
        green++;
      }

      const color = Utils.colorBasedOnDensity(density, this.thresholdDensity);

      this.renderer.setColorUniform(color);
      this.renderer.drawTriangle(i / 2, 3);

      this.renderer.setColorUniform([0, 0, 0, 1]);
      this.renderer.drawLoop(i / 2, 3);
    }

    this.setTriangleCount(red, green, blue);
  }

  drawPeople() {
    const peopleVertices = this.peopleVertices.flat();

    this.renderer.setPositionBuffer(peopleVertices);
    this.renderer.setColorUniform([0, 0, 0, 0.6]);
    this.renderer.drawPoints(0, this.peopleVertices.length);
  }

  drawObstacle() {
    const obstacleVertices = [];

    for (let i = 0; i <= 2; i++) {
      obstacleVertices.push(...this.transformedObstacleVertices[i]);
    }

    for (let i = 2; i <= 4; i++) {
      obstacleVertices.push(...this.transformedObstacleVertices[i % 4]);
    }

    this.renderer.setPositionBuffer(obstacleVertices);
    this.renderer.setColorUniform([0, 0, 0, 1]);
    this.renderer.drawTriangle(0, 6);
  }

  drawInitialScene() {
    // Vertices of the obstacle (Centered in the canvas)
    this.obstacleVertices = Utils.getCenteredRect(100, 100, this.canvas);
    this.obstacleCenter = [this.canvas.width / 2, this.canvas.height / 2];

    this.canvasCorners = Utils.getCanvasCorners(this.canvas);

    // Vertices for triangulation, First 4 vertices are obstacle vertices, Next 4 are canvas corners and rest are random vertices
    this.vertices = Utils.poissonDiskSampling(
      this.canvas.width,
      this.canvas.height,
      120,
      25,
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

  handleSliderActions() {
    const rangeMapping = {
      translateX: [-this.canvas.width / 2, this.canvas.width / 2],
      translateY: [-this.canvas.height / 2, this.canvas.height / 2],
      scale: [0, 3],
      rotate: [0, 360],
      crowdDensity: [1, 6],
      population: [80, 120],
    };

    const stepMapping = {
      translateX: 1,
      translateY: 1,
      scale: 0.1,
      rotate: 0,
      crowdDensity: 1,
      population: 20,
    };

    const defaultMapping = {
      translateX: this.translate[0],
      translateY: this.translate[1],
      scale: this.scale,
      rotate: this.rotate * (180 / Math.PI),
      crowdDensity: this.thresholdDensity,
      population: this.population,
    };

    const functionMapping = {
      translateX: (v) => (this.translate[0] = v),
      translateY: (v) => (this.translate[1] = v),
      scale: (v) => (this.scale = v),
      rotate: (v) => (this.rotate = v * (Math.PI / 180)),
      crowdDensity: (v) => (this.thresholdDensity = v),
      population: (v) =>
        (this.peopleVertices = Utils.poissonDiskSampling(
          this.canvas.width,
          this.canvas.height,
          50,
          v
        )),
    };

    const unitMapping = {
      translateX: "px",
      translateY: "px",
      scale: "x",
      rotate: "°",
      crowdDensity: "",
      population: "",
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

  handleMouseActions() {
    this.ACTION = null;

    this.canvas.addEventListener("mousedown", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (
        Utils.isPointInQuadrilateral(this.transformedObstacleVertices, [x, y])
      ) {
        this.ACTION = "moveObstacle";
        this.prevCoord = [x, y];
        this.canvas.style.cursor = "move";
        return;
      }

      for (let i = 0; i < this.peopleVertices.length; i++) {
        const dx = this.peopleVertices[i][0] - x;
        const dy = this.peopleVertices[i][1] - y;

        if (dx * dx + dy * dy < 8 * 8) {
          this.ACTION = "movePerson";
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

      if (this.ACTION === "movePerson") {
        this.peopleVertices[this.selectedPersonIndex] = [x, y];
      }

      if (this.ACTION === "moveObstacle") {
        this.translate[0] += x - this.prevCoord[0];
        this.translate[1] += y - this.prevCoord[1];
        this.prevCoord = [x, y];
      }

      if (this.ACTION == "movePerson" || this.ACTION === "moveObstacle") {
        this.syncUIState();
        this.drawScene();
      }
    });

    this.canvas.addEventListener("mouseup", (e) => {
      this.ACTION = null;
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
        this.syncUIState();
        this.drawScene();
      },
      { passive: false }
    );
  }

  syncUIState() {
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

  setTriangleCount(red, green, blue) {
    const redCountElement = document.querySelector("#redCount span");
    const greenCountElement = document.querySelector("#greenCount span");
    const blueCountElement = document.querySelector("#blueCount span");

    redCountElement.textContent = red;
    greenCountElement.textContent = green;
    blueCountElement.textContent = blue;
  }

  constructor() {
    this.canvas = document.querySelector("canvas");

    this.translate = [0, 0];
    this.scale = 1;
    this.rotate = 0;
    this.thresholdDensity = 4;
    this.population = 100;

    this.renderer = new Renderer();
    this.drawInitialScene();
    this.handleSliderActions();
    this.handleMouseActions();
  }
}

const app = new App();
