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

    const vertices = Utils.poissonDiskSampling(
      this.gl.canvas.width,
      this.gl.canvas.height,
      100,
      30
    );
    const delaunay = window.Delaunator.from(vertices);

    this.triangleVertices = [];
    delaunay.triangles.forEach((idx) => {
      this.triangleVertices.push(vertices[idx][0], vertices[idx][1]);
    });

    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array(this.triangleVertices),
      this.gl.STATIC_DRAW
    );

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
  }

  render() {
    // Boilerplate to setup canvas
    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    this.gl.useProgram(this.program);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
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

    for (let i = 0; i < this.triangleVertices.length; i += 6) {
      this.gl.uniform4f(
        this.colorUniformLocation,
        Math.random(),
        Math.random(),
        Math.random(),
        1
      );
      this.gl.drawArrays(this.gl.TRIANGLES, i / 2, 3);
    }
  }

  constructor() {
    this.initialize();
    this.render();
  }
}

new WebGLAPP();
