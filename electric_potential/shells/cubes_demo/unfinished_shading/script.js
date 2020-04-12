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
let angle_step = 2 * Math.PI / 8;
let radius = 1;
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
        normals.push(...(ball.slice(-6 * 3)));
    }
}

let cube_outline = [
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

let positions = [];
let normals = [];
let lines = [];

function gen_cube_triangles(corners, contour, tra) {
    // corners should be a length 8 array of potentials
    // returns triangles interpolated for contour
    // (as well as normals)
    let triangles = [];
    triangles.push([[0, 0, 0], [1, 0, 0], [0, 1, 0]]);
    let return_obj = {points: [], normals: []};
    for (let triangle of triangles) {
        positions.push(...triangle.flat());
        let normal = misc.norm(
            misc.cross(
                misc.sub_vec(triangle[0], triangle[1]),
                misc.sub_vec(triangle[1], triangle[2])
            );
        );
        normals.push(
            ...normal, ...normal, ...normal
        );
    }
    return return_obj;
}

// in real application, would not bother with look up table
for (let i = 0; i < 255; i ++) {
    let corners = [];
    for (let b = 0; b < 8; b++) {
        corners.push(i & (1 << b));
    }

    //use this function in a map call
    let translate_points = (x,y,z) => (v,i) => v + [x,y,z][i%3];
    // calculate a row and column for translation
    let r = i >> 4;
    let c = i & 0xf;

    r *= 3; c *= 3;

    let obj = gen_cube_triangles(corners, 0.5);
    positions.push(...obj.map(translate_points(r, 0, c)));
    positions.push(...ball.map(translate_points(r, 0, c)));
    lines.push(...cube_outline.map(translate_points(r, 0, c)));
}

let positions_buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positions_buffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

let lines_buffer = gl.createBuffer();
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
let far = 50; //furthest z-coordianted to be rendered
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
    if (e.buttons) {
        let sensitivity = 400;
        space_yaw -= e.movementX / sensitivity;
        space_pitch -= e.movementY / sensitivity;
        if (space_pitch > Math.PI/2) space_pitch = Math.PI / 2;
        if (space_pitch < -Math.PI/2) space_pitch = -Math.PI / 2;
    }
});
