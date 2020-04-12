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

let a_position_loc = gl.getAttribLocation(program, 'a_position');
let u_world_matrix_loc = gl.getUniformLocation(program, 'u_world_matrix');

let a_line_position_loc = gl.getAttribLocation(line_program, 'a_position');
let u_line_world_matrix_loc = gl.getUniformLocation(line_program, 'u_world_matrix');

gl.enableVertexAttribArray(a_position_loc);
gl.enableVertexAttribArray(a_line_position_loc);

let ball = [];
let normals = [];

let angle_step = 2 * Math.PI / 4;
let radius = 0.1;
function get_position_on_ball(yaw, pitch) {
    return [
        radius * Math.cos(pitch) * Math.sin(yaw),
        radius * Math.sin(pitch),
        radius * Math.cos(pitch) * Math.cos(yaw)
    ];
};
for (let yaw = 0; yaw < Math.PI * 2; yaw += angle_step) {
    for (let pitch = -Math.PI / 2; pitch < Math.PI / 2; pitch += angle_step) {
        ball.push(...get_position_on_ball(yaw, pitch));
        ball.push(...get_position_on_ball(yaw + angle_step, pitch));
        ball.push(...get_position_on_ball(yaw + angle_step, pitch + angle_step));
        ball.push(...get_position_on_ball(yaw, pitch));
        ball.push(...get_position_on_ball(yaw, pitch + angle_step));
        ball.push(...get_position_on_ball(yaw + angle_step, pitch + angle_step));
    }
}

// outline of a unit cube in positve octant
let cube_outline = [
    0, 0, 0, 1, 0, 0,
    0, 0, 1, 1, 0, 1,
    0, 1, 0, 1, 1, 0,
    0, 1, 1, 1, 1, 1,
    1, 0, 0, 1, 0, 1,
    0, 0, 0, 0, 0, 1,
    1, 1, 0, 1, 1, 1,
    0, 1, 0, 0, 1, 1,
    0, 0, 0, 0, 1, 0,
    0, 0, 1, 0, 1, 1,
    1, 0, 0, 1, 1, 0,
    1, 0, 1, 1, 1, 1,
];

let positions = [];
let lines = [];

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
    if (!triangle_edges.every(edge_index => interpolated_vertex_positions[edge_index])) {
        console.log(edges, triangle_edges);
        console.log('not calculated a required edge!');
    }
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

function populate_buffers() {
    positions = [];
    lines = [];
    for (let i = 0; i < 255; i ++) {
        let corner_potentials = [];
        for (let b = 0; b < 8; b++) {
            corner_potentials.push((i >> b) & 1);
        }

        //use this function in a map call
        let translate_points = (x,y,z) => (v,i) => v + [x,y,z][i%3];
        // calculate a row and column for translation
        let r = i >> 4;
        let c = i & 0xf;
        r = (r-8)*2 + world_trans[0];
        c = (c-8)*2 + world_trans[1];

        let corner_vertexes = [[0, 0, 1], [1, 0, 1], [1, 0, 0], [0, 0, 0],
             [0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]];

        let triangles = gen_cube_triangles(0.5, corner_potentials, corner_vertexes);
        positions.push(...triangles.map(translate_points(r, 0, c)));
        for (let j = 0; j < 8; j++) {
            if (corner_potentials[j] < 0.5)
            positions.push(
                ...ball.map(
                    translate_points(...corner_vertexes[j])).map(
                    translate_points(r,0,c))
            );
        }
        lines.push(...cube_outline.map(translate_points(r, 0, c)));
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, positions_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, lines_buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lines), gl.STATIC_DRAW);
}

let positions_buffer = gl.createBuffer();
let lines_buffer = gl.createBuffer();

let world_trans = [0,0];

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

let cam = [0, 10, -1]; // issues when cam is up x-axis with panning of space_pitch !!

// space is the grid
let space_yaw = 0;
let space_pitch = 0;

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
    populate_buffers(); //populating each time to account for transform

    let u_matrix = calc_u_matrix();

    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);
    gl.uniformMatrix4fv(u_world_matrix_loc, false, m4.gl_format(u_matrix));
    gl.bindBuffer(gl.ARRAY_BUFFER, positions_buffer);
    gl.vertexAttribPointer(a_position_loc, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, positions.length / 3);

    gl.useProgram(line_program);
    gl.uniformMatrix4fv(u_line_world_matrix_loc, false, m4.gl_format(u_matrix));
    gl.bindBuffer(gl.ARRAY_BUFFER, lines_buffer);
    gl.vertexAttribPointer(a_line_position_loc, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.LINES, 0, lines.length / 3);

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
    if (e.buttons & 2) { // right click and hold
        let sensitivity = 400;
        space_yaw -= e.movementX / sensitivity;
        space_pitch -= e.movementY / sensitivity;
        if (space_pitch > Math.PI/2) space_pitch = Math.PI / 2;
        if (space_pitch < -Math.PI/2) space_pitch = -Math.PI / 2;
    } else if (e.buttons & 1) { // left click and hold
        world_trans[0] += e.movementX / 90;
        world_trans[1] -= e.movementY / 90;
    }
});
