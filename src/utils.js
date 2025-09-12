export default class Utils {
  // prettier-ignore
  static projectionMatrix(w, h) {
    return [
      2/w, 0, 0,
      0, -2/h, 0,
      -1, 1, 1
    ];
  }

  // prettier-ignore
  static translationMatrix(tx, ty) {
    return [
      1, 0, tx,
      0, 1, ty,
      0, 0, 1
    ];
  }

  // prettier-ignore
  static rotationMatrix(angleInRadians) {
    const c = Math.cos(angleInRadians);
    const s = Math.sin(angleInRadians);
    return [
      c, -s, 0,
      s, c, 0,
      0, 0, 1
    ];
  }

  // prettier-ignore
  static scalingMatrix(sx, sy) {
    return [
      sx, 0, 0,
      0, sy, 0,
      0, 0, 1
    ];
  }

  // prettier-ignore
  static multiplyMM(a, b) {
    const a00 = a[0 * 3 + 0];
    const a01 = a[0 * 3 + 1];
    const a02 = a[0 * 3 + 2];
    const a10 = a[1 * 3 + 0];
    const a11 = a[1 * 3 + 1];
    const a12 = a[1 * 3 + 2];
    const a20 = a[2 * 3 + 0];
    const a21 = a[2 * 3 + 1];
    const a22 = a[2 * 3 + 2];
    const b00 = b[0 * 3 + 0];
    const b01 = b[0 * 3 + 1];
    const b02 = b[0 * 3 + 2];
    const b10 = b[1 * 3 + 0];
    const b11 = b[1 * 3 + 1];
    const b12 = b[1 * 3 + 2];
    const b20 = b[2 * 3 + 0];
    const b21 = b[2 * 3 + 1];
    const b22 = b[2 * 3 + 2];
  
    return [
      a00 * b00 + a01 * b10 + a02 * b20,
      a00 * b01 + a01 * b11 + a02 * b21,
      a00 * b02 + a01 * b12 + a02 * b22,
      a10 * b00 + a11 * b10 + a12 * b20,
      a10 * b01 + a11 * b11 + a12 * b21,
      a10 * b02 + a11 * b12 + a12 * b22,
      a20 * b00 + a21 * b10 + a22 * b20,
      a20 * b01 + a21 * b11 + a22 * b21,
      a20 * b02 + a21 * b12 + a22 * b22,
    ];
  }

  static multiplyManyMM(...matrices) {
    let result = matrices[0];
    for (let i = 1; i < matrices.length; i++) {
      result = Utils.multiplyMM(result, matrices[i]);
    }
    return result;
  }

  // prettier-ignore
  static multiplyMV(m, v) {
    const v0 = v[0];
    const v1 = v[1];
    const v2 = v[2];
    return [
      m[0 * 3 + 0] * v0 + m[0 * 3 + 1] * v1 + m[0 * 3 + 2] * v2,
      m[1 * 3 + 0] * v0 + m[1 * 3 + 1] * v1 + m[1 * 3 + 2] * v2,
      m[2 * 3 + 0] * v0 + m[2 * 3 + 1] * v1 + m[2 * 3 + 2] * v2,
    ];
  }

  // returns coordinates of centered rectangle
  static getCenteredRect(rectWidth, rectHeight, gl) {
    const canvasWidth = gl.canvas.width;
    const canvasHeight = gl.canvas.height;
    const x = (canvasWidth - rectWidth) / 2;
    const y = (canvasHeight - rectHeight) / 2;
    return [
      [x, y],
      [x + rectWidth, y],
      [x + rectWidth, y + rectHeight],
      [x, y + rectHeight],
    ];
  }

  static getCanvasCorners(gl) {
    const canvasWidth = gl.canvas.width;
    const canvasHeight = gl.canvas.height;
    return [
      [0, 0],
      [canvasWidth, 0],
      [canvasWidth, canvasHeight],
      [0, canvasHeight],
    ];
  }

  static poissonDiskSampling(
    width,
    height,
    radius,
    numVertices,
    initialVertices = [],
    k = 30
  ) {
    const cellSize = radius / Math.sqrt(2);
    const gridWidth = Math.ceil(width / cellSize);
    const gridHeight = Math.ceil(height / cellSize);

    const grid = new Array(gridWidth * gridHeight).fill(null);
    const vertices = [];
    const active = [];

    function gridIndex(x, y) {
      return y * gridWidth + x;
    }

    function isFarEnough(px, py) {
      const gx = Math.floor(px / cellSize);
      const gy = Math.floor(py / cellSize);

      for (let i = -2; i <= 2; i++) {
        for (let j = -2; j <= 2; j++) {
          const nx = gx + i;
          const ny = gy + j;
          if (nx >= 0 && ny >= 0 && nx < gridWidth && ny < gridHeight) {
            const neighborIndex = grid[gridIndex(nx, ny)];
            if (neighborIndex !== null) {
              const [qx, qy] = vertices[neighborIndex];
              const dx = px - qx;
              const dy = py - qy;
              if (dx * dx + dy * dy < radius * radius) {
                return false;
              }
            }
          }
        }
      }
      return true;
    }

    if (initialVertices.length === 0) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      initialVertices.push([x, y]);
    }

    initialVertices.forEach(([x, y]) => {
      const idx = vertices.length;
      vertices.push([x, y]);
      active.push(idx);
      grid[gridIndex(Math.floor(x / cellSize), Math.floor(y / cellSize))] = idx;
    });

    // Generating the rest of the vertices using Bridson's algorithm
    while (active.length > 0 && vertices.length < numVertices) {
      const randIndex = Math.floor(Math.random() * active.length);
      const pointIndex = active[randIndex];
      const [px, py] = vertices[pointIndex];

      let found = false;
      for (let i = 0; i < k; i++) {
        const angle = Math.random() * 2 * Math.PI;
        const r = radius * (1 + Math.random());
        const nx = px + r * Math.cos(angle);
        const ny = py + r * Math.sin(angle);

        if (
          nx >= 0 &&
          ny >= 0 &&
          nx <= width &&
          ny <= height &&
          isFarEnough(nx, ny)
        ) {
          const newIndex = vertices.length;
          vertices.push([nx, ny]);
          active.push(newIndex);
          grid[
            gridIndex(Math.floor(nx / cellSize), Math.floor(ny / cellSize))
          ] = newIndex;
          found = true;
          break;
        }
      }

      if (!found) {
        active.splice(randIndex, 1);
      }
    }

    vertices.map(([x, y]) => [Math.round(x), Math.round(y)]);

    return vertices;
  }

  static countPointsInsideTriangle(points, triangle) {
    function sign(x1, y1, x2, y2, x3, y3) {
      return (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3);
    }

    function pointInTriangle(px, py, ax, ay, bx, by, cx, cy) {
      const d1 = sign(px, py, ax, ay, bx, by);
      const d2 = sign(px, py, bx, by, cx, cy);
      const d3 = sign(px, py, cx, cy, ax, ay);

      const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
      const hasPos = d1 > 0 || d2 > 0 || d3 > 0;

      return !(hasNeg && hasPos);
    }

    let count = 0;
    for (const [px, py] of points) {
      if (
        pointInTriangle(
          px,
          py,
          triangle[0],
          triangle[1],
          triangle[2],
          triangle[3],
          triangle[4],
          triangle[5]
        )
      ) {
        count++;
      }
    }
    return count;
  }
}
