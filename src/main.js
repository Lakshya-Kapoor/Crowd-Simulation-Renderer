import cdt2d from "https://cdn.jsdelivr.net/npm/cdt2d@1.0.0/+esm";
import Utils from "./utils.js";

class WebGLAPP {
  vertexShaderSource = `
    attribute vec2 a_position;

    uniform mat3 u_matrix;

    void main() {
      gl_Position = vec4((u_matrix * vec3(a_position, 1)).xy, 0, 1);
      gl_PointSize = 5.0;
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

  setTriangles(vertices) {
    this.triangulatedVertices = [];

    // Apply R, T, S to the first four vertices (obstacle)
    for (let i = 0; i < 4; i++) {
      let transformationMatrix = Utils.multiplyManyMM(
        Utils.translationMatrix(this.translate[0], this.translate[1]),
        Utils.translationMatrix(this.canvas.width / 2, this.canvas.height / 2),
        Utils.rotationMatrix(this.rotate),
        Utils.scalingMatrix(this.scale, this.scale),
        Utils.translationMatrix(-this.canvas.width / 2, -this.canvas.height / 2)
      );

      const res = Utils.multiplyMV(transformationMatrix, [
        vertices[i][0],
        vertices[i][1],
        1,
      ]);

      vertices[i] = res.slice(0, 2);
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
        this.triangulatedVertices.push(vertices[idx][0], vertices[idx][1]);
      });
    });

    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array(this.triangulatedVertices),
      this.gl.STATIC_DRAW
    );
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
    for (let i = 0; i < this.triangulatedVertices.length; i += 6) {
      // this.gl.uniform4f(
      //   this.colorUniformLocation,
      //   Math.random(),
      //   Math.random(),
      //   Math.random(),
      //   1
      // );
      // this.gl.drawArrays(this.gl.TRIANGLES, i / 2, 3);

      this.gl.uniform4f(this.colorUniformLocation, 0, 0, 0, 1);
      this.gl.drawArrays(this.gl.LINE_LOOP, i / 2, 3);
    }
  }

  drawObstacle() {
    const obstacleVertices = [];

    for (let i = 0; i <= 2; i++) {
      obstacleVertices.push(
        this.obstacleVertices[i][0],
        this.obstacleVertices[i][1]
      );
    }

    for (let i = 2; i <= 4; i++) {
      obstacleVertices.push(
        this.obstacleVertices[i % 4][0],
        this.obstacleVertices[i % 4][1]
      );
    }

    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array(obstacleVertices),
      this.gl.DYNAMIC_DRAW
    );

    this.gl.uniform4f(this.colorUniformLocation, 0, 0, 0, 1);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
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

    const initialVertices = [...this.obstacleVertices, ...this.canvasCorners];
    const vertices = Utils.poissonDiskSampling(
      this.canvas.width,
      this.canvas.height,
      120,
      20,
      initialVertices
    );

    this.setTriangles(vertices);
    this.drawTriangles();
    // this.drawObstacle();
  }

  constructor() {
    this.translate = [0, 0];
    this.scale = 1;
    this.rotate = 0;

    this.initialize();
    this.render();
  }
}

new WebGLAPP();
