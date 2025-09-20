import Utils, { Matrix } from "./utils.js";

export default class Renderer {
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

  createAndBindBuffers() {
    this.positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
  }

  getAttributeLocations() {
    this.positionAttributeLocation = this.gl.getAttribLocation(
      this.program,
      "a_position"
    );
  }

  getUniformLocations() {
    this.matrixUniformLocation = this.gl.getUniformLocation(
      this.program,
      "u_matrix"
    );

    this.colorUniformLocation = this.gl.getUniformLocation(
      this.program,
      "u_color"
    );
  }

  setupAttributes() {
    this.gl.enableVertexAttribArray(this.positionAttributeLocation);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.vertexAttribPointer(
      this.positionAttributeLocation,
      2,
      this.gl.FLOAT,
      false,
      0,
      0
    );
  }

  setProjectionUniform() {
    this.gl.uniformMatrix3fv(
      this.matrixUniformLocation,
      false,
      Matrix.transpose(Matrix.projection(this.canvas.width, this.canvas.height))
    );
  }

  setColorUniform(color) {
    this.gl.uniform4f(this.colorUniformLocation, ...color);
  }

  setPositionBuffer(data) {
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array(data),
      this.gl.DYNAMIC_DRAW
    );
  }

  drawTriangle(first, count) {
    this.gl.drawArrays(this.gl.TRIANGLES, first, count);
  }

  drawLoop(first, count) {
    this.gl.drawArrays(this.gl.LINE_LOOP, first, count);
  }

  drawPoints(first, count) {
    this.gl.drawArrays(this.gl.POINTS, first, count);
  }

  clear() {
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  constructor() {
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
    this.gl.useProgram(this.program);

    this.createAndBindBuffers();
    this.getAttributeLocations();
    this.setupAttributes();
    this.getUniformLocations();
    this.setProjectionUniform();

    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
    this.gl.clearColor(0, 0, 0, 0);
  }
}
