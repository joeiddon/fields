'use strict';

/*
 * Good fundamental resource: https://webglfundamentals.org/
 * Shaders are defined as strings in the `shaders.js` script.
 *
 * Ultimately WebGL is a 2d rasterization (fills pixels from vector graphic)
 * library, but the Graphics Library Shader Language (GLSL) has features
 * that make writing 3d engines easier. This includes things like matrix
 * operations, dot products, and options like CULL_FACE and DEPTH (Z) BUFFER.
 */

// ensure this matches the vertex shader #define
const MAX_CHARGES = 50;

let canvas = document.getElementById('canvas');
let gl = canvas.getContext('webgl');
if (!gl) canvas.innerHTML = 'Oh no! WebGL is not supported.';

function fit_canvas_to_screen(){
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
}
fit_canvas_to_screen();
window.addEventListener('resize', fit_canvas_to_screen);

let program = misc.create_gl_program(vertex_shader_src, fragment_shader_src);
let line_program = misc.create_gl_program(line_vertex_shader_src, fragment_shader_src);

//set the color we want to clear to
gl.clearColor(0, 0, 0, 1);

gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
gl.enable(gl.DEPTH_TEST);

let a_position_loc = gl.getAttribLocation(program, 'a_position');
let a_color_loc = gl.getAttribLocation(program, 'a_color');
let u_world_matrix_loc = gl.getUniformLocation(program, 'u_world_matrix');

let a_line_position_loc = gl.getAttribLocation(line_program, 'a_position');
let u_line_world_matrix_loc = gl.getUniformLocation(line_program, 'u_world_matrix');

gl.enableVertexAttribArray(a_position_loc);
gl.enableVertexAttribArray(a_color_loc);
gl.enableVertexAttribArray(a_line_position_loc);

function compute_V(x, y, z) {
    let V_SCALING_FACTOR = 0.04; // this should be extracted from the shader source code maybe!
    let V = 0;
    for (let charge of [mouse_charge, ...charges]) {
        let d = (
            (x - charge.position[0]) ** 2 +
            (y - charge.position[1]) ** 2 + 
            (z - charge.position[2]) ** 2
        ) ** 0.5;
        if (d == 0) d = 0.00001;
        V += -1.0 * V_SCALING_FACTOR * charge.magnitude / d;
    }
    return V;
}

let positions = [];
let colors = [];

function gen_cube_triangles(contour, corner_potentials, corner_vertexes) {
    let cube_index = 0; // an 8-bit integer representing cube type
    // HAVENT CHECKED IF THIS CUBE INDEX CALCULATION IS WORKING !!!
    for (let i = 0; i < 8; i++) if (corner_potentials[i] < contour) cube_index |= 1 << i;

    // use the cube index to retrieve the involved edges and how these are
    // connected to form triangles from the data set from
    // http://paulbourke.net/geometry/polygonise/ (defined in helpers.js)
    // the lookup tables encode the data in binary numbers
    // I also added edge_vertex_neighbours structure to shorten this code
    let edges = marching_data.edges[cube_index];
    let triangle_edges = marching_data.triangles[cube_index];
    // will only interpolate edges needed, adding to the following array
    let interpolated_vertex_positions = new Array(12);
    for (let i = 0; i < 12; i++){
        if (edges & (1 << i)) {
            // if so, contour surface passes through this edge, so interpolate to find vertex position
            // cube vertex indexes of neighbours
            let vertex_indexes = marching_data.edge_vertex_neighbours[i];
            interpolated_vertex_positions[i] = interp_cube_vertexes(
                contour,
                corner_vertexes[vertex_indexes[0]],
                corner_vertexes[vertex_indexes[1]],
                corner_potentials[vertex_indexes[0]],
                corner_potentials[vertex_indexes[1]],
            );
        }
    }
    //if (!triangle_edges.every(edge_index => interpolated_vertex_positions[edge_index])) {
    //    console.log(edges, triangle_edges);
    //    console.log('not calculated a required edge!');
    //}
    return triangle_edges.map(
        edge_index => interpolated_vertex_positions[edge_index]
    ).flat();
}

function interp_cube_vertexes(contour, p1, p2, pot1, pot2) {
    // p1 and p2 are 3d coordinates [x,y,z]
    // pot1 and pot2 are the corresponding potentials
    // contour is potential to return a target interpolated coordinate
    let x = (contour - pot1) / (pot2 - pot1);
    // next line computes the vector calc: p1 + x * (p2 - p1)
    return p1.map((c,i) => c + x * (p2[i] - c));
}

//across each dimension of cube
let divisions = 20;
// verticies of a cube in positive octant, ordered in accordance with diagram
// at: http://paulbourke.net/geometry/polygonise/ 
let corner_vertexes = [
    [0, 0, 1], [1, 0, 1], [1, 0, 0], [0, 0, 0],
    [0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]
];

function compute_shell(potential) {
    /*
     * computes the triangles for the shell at potential, adding them to global
     * positions array, as well as colors to the colors global array
     */
    for (let xx = 0; xx < divisions; xx ++) {
        for (let yy = 0; yy < divisions; yy ++) {
            for (let zz = 0; zz < divisions; zz ++) {
                // conver the integers into the appropriate floting points
                let x = xx / divisions * 2 - 1;
                let y = yy / divisions * 2 - 1;
                let z = zz / divisions * 2 - 1;
                // list of vertices of the cube in the space
                let k = 2 / divisions; //dimension of the cube in space coordinates
                let this_cube = corner_vertexes.map(p => [k*p[0]+x, k*p[1]+y, k*p[2]+z]);
                let corner_potentials = this_cube.map(p => compute_V(...p));
                let points = gen_cube_triangles(
                    potential,
                    corner_potentials,
                    this_cube
                );
                positions.push(...points);
                for (let i = 0; i < points.length / 3; i++)
                    colors.push(
                        potential > 0 ? potential / 1.2 : 0,
                        Math.abs(potential) < 0.001 ? 1 : 0,
                        potential < 0 ? -potential / 1.2: 0
                    );
            }
        }
    }
}

function populate_positions_buffer() {
    /*
     * calculates shells using marching cubes algorithm
     * then populates the positions buffer
     */
    // clear arrays for buffers about to populate
    positions = [];
    colors = [];
    for (let V = -1.2; V < 1.2; V += 0.4) {
        compute_shell(V);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, positions_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, colors_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
}

let positions_buffer = gl.createBuffer();
let lines_buffer = gl.createBuffer();
let colors_buffer = gl.createBuffer();

let lines = [
    // axis lines
    1, 0, 0,
    -1, 0, 0,
    0, 1, 0,
    0, -1, 0,
    0, 0, 1,
    0, 0, -1,

    // adding edges of the cube too
    -1, -1, -1, 1, -1, -1,
    -1, -1, 1, 1, -1, 1,
    -1, 1, -1, 1, 1, -1,
    -1, 1, 1, 1, 1, 1,
    1, -1, -1, 1, -1, 1,
    -1, -1, -1, -1, -1, 1,
    1, 1, -1, 1, 1, 1,
    -1, 1, -1, -1, 1, 1,
    -1, -1, -1, -1, 1, -1,
    -1, -1, 1, -1, 1, 1,
    1, -1, -1, 1, 1, -1,
    1, -1, 1, 1, 1, 1,
];

gl.bindBuffer(gl.ARRAY_BUFFER, lines_buffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lines), gl.STATIC_DRAW);

function perspective_mat(fov, aspect, near, far){
    return [
        [ 1/(aspect*Math.tan(fov/2)),                 0,                     0,                     0],
        [                          0, 1/Math.tan(fov/2),                     0,                     0],
        [                          0,                 0, (far+near)/(far-near), 2*near*far/(near-far)],
        [                          0,                 0,                     1,                     0]
    ];
}

let fov = misc.deg_to_rad(50);
let near = 0.1; //closest z-coordinate to be rendered
let far = 500; //furthest z-coordianted to be rendered
let m_perspective;

function calculate_perspective_matrix() {
    // put in function so can call again on canvas re-size when aspect changes
    let aspect = canvas.width/canvas.height;
    m_perspective = perspective_mat(fov, aspect, near, far);
}
calculate_perspective_matrix();
window.addEventListener('resize', calculate_perspective_matrix);

let cam = [0, 1.5, -3]; // issues when cam is up x-axis with panning of space_pitch !!

// space is the grid
let space_yaw = 0;
let space_pitch = 0;

let charges = [];
let mouse_charge = {position: [0, 0, 0], magnitude: -0.5};

function calc_u_matrix(){
    // matrices in right-to-left order (i.e. in order of application)

    // rotates space according to space_yaw and space_pitch
    let m_rot = m4.multiply(m4.rotation_x(space_pitch), m4.rotation_y(space_yaw));
    //transforms in front of cam's view
    let m_view = m4.multiply(m4.inverse(m4.orient(cam, [0,0,0])), m_rot);
    //maps 3d to 2d
    let m_world = m4.multiply(m_perspective, m_view);
    return m_world;
}

function update() {
    populate_positions_buffer(); //populating each time to account for changes

    let u_matrix = calc_u_matrix();

    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(line_program);
    gl.uniformMatrix4fv(u_line_world_matrix_loc, false, m4.gl_format(u_matrix));
    gl.bindBuffer(gl.ARRAY_BUFFER, lines_buffer);
    gl.vertexAttribPointer(a_line_position_loc, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.LINES, 0, lines.length / 3);

    if (positions.length) {
        if (colors.length != positions.length) console.error('colors and positions data not same length');
        gl.depthMask(false); // disable writing to z buffer for transparent shells
        gl.useProgram(program);
        gl.uniformMatrix4fv(u_world_matrix_loc, false, m4.gl_format(u_matrix));
        gl.bindBuffer(gl.ARRAY_BUFFER, positions_buffer);
        gl.vertexAttribPointer(a_position_loc, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, colors_buffer);
        gl.vertexAttribPointer(a_color_loc, 3, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, positions.length / 3);
        gl.depthMask(true);
    }

    requestAnimationFrame(update);
}

update();

function toclipspace(x, y) {
    return [
        (x / canvas.width) * 2 - 1,
        -((y / canvas.height) * 2 - 1),
    ];
}

canvas.addEventListener('mousemove', function(e) {
    let sensitivity = 400;
    // if right click held down, so panning
    if (e.buttons & 2) {
        space_yaw -= e.movementX / sensitivity;
        space_pitch -= e.movementY / sensitivity;
        if (space_pitch > Math.PI/2) space_pitch = Math.PI / 2;
        if (space_pitch < -Math.PI/2) space_pitch = -Math.PI / 2;
    } else {
        // move mouse charge
        mouse_charge.position = [...toclipspace(e.x, e.y), 0];
    }
});

canvas.addEventListener('wheel', e => {mouse_charge.magnitude += e.deltaY / 200});
canvas.addEventListener('click', e => {charges.push({position: [...mouse_charge.position], magnitude: mouse_charge.magnitude})}); // unpacked so creates new object
