'use strict';

/*
 * Good fundamental resource: https://webglfundamentals.org/
 * Shaders are defined as strings in the `shaders.js` script.
 *
 * Ultimately WebGL is a 2d rasterization (fills pixels from vector graphic)
 * library, but the Graphics Library Shader Language (GLSL) has features
 * that make writing 3d engines easier. This includes things like matrix
 * operations, dot products, and options like CULL_FACE and DEPTH (Z) BUFFER.
 *
 * For good, clear definitions of buffers etc. see:
 * https://webglfundamentals.org/webgl/lessons/webgl-fundamentals.html
 */

/*
 * TODO:
 * add contour lines / better color scheme
 * write a library to deal with vectors
 * code to map mouse pointer to surface properly
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

let potential_program = misc.create_gl_program(potential_vertex_shader_src, fragment_shader_src);
let charge_program = misc.create_gl_program(charge_vertex_shader_src, fragment_shader_src);

//set the color we want to clear to
gl.clearColor(0, 0, 0, 1);

let a_position_loc = gl.getAttribLocation(potential_program, 'a_position');
let u_world_matrix_loc = gl.getUniformLocation(potential_program, 'u_world_matrix');
let u_view_matrix_loc = gl.getUniformLocation(potential_program, 'u_view_matrix');
let u_charges_loc = gl.getUniformLocation(potential_program, 'u_charges');
let u_light_loc = gl.getUniformLocation(potential_program, 'u_light');

let a_charge_position_loc = gl.getAttribLocation(charge_program, 'a_position');
let a_charge_normal_loc = gl.getAttribLocation(charge_program, 'a_normal'); // spelling error ?
let u_charge_world_matrix_loc = gl.getUniformLocation(charge_program, 'u_world_matrix');
let u_charge_view_matrix_loc = gl.getUniformLocation(charge_program, 'u_view_matrix');
let u_charge_light_loc = gl.getUniformLocation(charge_program, 'u_light');
let u_charge_ball_translate_loc = gl.getUniformLocation(charge_program, 'u_ball_translate');

// if any locations are -1, that means they are not being used in the shaders,
// so compiler got rid of them

gl.enableVertexAttribArray(a_position_loc);
gl.enableVertexAttribArray(a_charge_position_loc);
gl.enableVertexAttribArray(a_charge_normal_loc);


let step = parseFloat(window.location.hash.slice(1));
if (!(step > 0)) step = 0.01; //default value for if no hash, so step is NaN
window.onhashchange = () => window.location.reload();

// positions are in charge / grid coordiantes x, y in [0,1]
let positions = [];
// the 1 - step/2 is to avoid floating point comparison errors
for (let y = -1; y < 1 - step / 2; y += step)
    for (let x = -1; x < 1 - step / 2; x += step)
        positions.push(
                 x, y,
            x+step, y,
            x+step, y+step,
                 x, y,
            x+step, y+step,
                 x, y+step
        );

let positions_buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positions_buffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

let ball = [];
let normals = [];

let angle_step = 2 * Math.PI / 32;
let radius = 0.02;

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
        //for (let i = 0; i < 6; i++)
        //normals.push(...get_position_on_ball(yaw + angle_step / 2 , pitch + angle_step / 2));
        // pushing normals for actual corners, on a per-vertex basis!
        normals.push(...(ball.slice(-6 * 3)));
    }
}

let charge_positions_buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, charge_positions_buffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ball), gl.STATIC_DRAW);

let charge_normals_buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, charge_normals_buffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

//clockwise triangles are back-facing, counter-clockwise are front-facing
//switch two verticies to easily flip direction a triangle is facing
//"cull face" feature means kill (don't render) back-facing triangles
//gl.enable(gl.CULL_FACE);

//enable the z-buffer (only drawn if z component LESS than that already there)
gl.enable(gl.DEPTH_TEST);

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

let cam = [0, 1.2, -3]; // issues when cam is up x-axis with panning of space_pitch !!

// space is the grid
let space_yaw = 0;
let space_pitch = 0;

let light = [-0.1, -1.5, 0.8]; // normalised in vertex shader

// the "mouse charge" is always the first charge
let charges = [
    {position: [0, 0], magnitude: -0.5}
];

let matrices = {};

function calculate_matrices(){
    // matrices in right-to-left order (i.e. in order of application)

    // rotates space according to space_yaw and space_pitch
    matrices.rot = m4.multiply(m4.rotation_x(space_pitch), m4.rotation_y(space_yaw));
    //transforms in front of cam's view
    matrices.view = m4.multiply(m4.inverse(m4.orient(cam, [0,0,0])), matrices.rot);
    //maps 3d to 2d
    matrices.world = m4.multiply(m_perspective, matrices.view);
}

let test_charge = {
    magnitude: 0.5,
    position: [0, 0],
    velocity: [0, 0]
}

let paused = false;
let sticked = false;
// press `p` key to pause, 's' to stick mouse charge
document.addEventListener('keydown', e=>{
    if (e.key == 'p') paused = !paused;
    if (e.key == 's') sticked = !sticked;
});

function update_test_charge() {
    if (paused) return;
    /// !!!! // separate computation of electric field, E, to separate function !!!
    let E = [0, 0];
    let k = 0.00005;
    for (let charge of charges) {
        let d = ((charge.position[0]-test_charge.position[0])**2 + (charge.position[1]-test_charge.position[1])**2)**0.5;
        if (d == 0) d = 0.001;
        //if (d > 0.1) { // dont do anything if too close (note: if remove this, watch out for divide by zero!)
            E[0] += k * charge.magnitude * (charge.position[0] - test_charge.position[0]) / d ** 2;
            E[1] += k * charge.magnitude * (charge.position[1] - test_charge.position[1])  / d ** 2;
        //}
    }
    let a = [
        test_charge.magnitude * E[0],
        test_charge.magnitude * E[1]
    ];
    // NOT INCLUDING TIME, t, IN THESE EQUATIONS, for now
    // using s = ut + 1/2 at ^ 2
    test_charge.position[0] += test_charge.velocity[0] + 0.5 * a[0];
    test_charge.position[1] += test_charge.velocity[1] + 0.5 * a[1];
    if (test_charge.position[0] > 1) {test_charge.position[0] = 1; test_charge.velocity = [0,0];}
    if (test_charge.position[0] < -1) {test_charge.position[0] = -1; test_charge.velocity = [0,0];}
    if (test_charge.position[1] > 1) {test_charge.position[1] = 1; test_charge.velocity = [0,0];}
    if (test_charge.position[1] < -1) {test_charge.position[1] = -1; test_charge.velocity = [0,0];}
    // using v = u + at
    test_charge.velocity[0] += a[0];
    test_charge.velocity[1] += a[1];
}

function compute_V(x, y) {
    let V_SCALING_FACTOR = 0.04; // this should be extracted from the shader source code maybe!
    let V = 0;
    for (let charge of charges) {
        let d = ((x - charge.position[0]) ** 2 + (y - charge.position[1]) ** 2) ** 0.5;
        if (d == 0) d = 0.00001;
        V += -1.0 * V_SCALING_FACTOR * charge.magnitude / d;
    }
    return V;
}

/* not used for making ball sit on surface as not true representation of position.
function compute_normal(x, y) {
    let dfdx = 0;
    let dfdy = 0;
    for (let charge of charges){
        let d = ((x - charge.position[0]) ** 2 + (y - charge.position[1]) ** 2) ** 0.5;
        if (d == 0) d = 0.0001;
        dfdx += charge.magnitude * (x - charge.position[0]) / (d ** 3);
        dfdy += charge.magnitude * (y - charge.position[1]) / (d ** 3);
    }
    let n = [-dfdx, 1, -dfdy];
    return n.map(c => c / (n[0] ** 2 + n[1] ** 2 + n[2] ** 2) ** 0.5);
}
*/

function calculate_test_charge_trans() {
    let surface_position = [
        test_charge.position[0],
        compute_V(...test_charge.position) + radius,
        test_charge.position[1]
    ];
    return surface_position;
    /*
    surface_position = [0, 1, 0];
    let normal_offset = compute_normal(...test_charge.position);
    normal_offset = [0, 1, 0];
    return surface_position.map((c,i) => c + normal_offset[i] * radius);
    */
}


let last_time;
let time_delta;
function update(time) {
    time_delta = time - (last_time || time);
    last_time = time;
    calculate_matrices();

    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(potential_program);

    gl.uniformMatrix4fv(u_view_matrix_loc, false, m4.gl_format(matrices.rot));
    gl.uniformMatrix4fv(u_world_matrix_loc, false, m4.gl_format(matrices.world));
    gl.uniform3fv(u_light_loc, new Float32Array(light));
    let u_charges_data = [];
    for (let i = 0; i < MAX_CHARGES; i ++){ // -1 because one taken up by mouse
        if (i < charges.length) u_charges_data.push(...charges[i].position, charges[i].magnitude);
        else u_charges_data.push(0, 0, 0);
    }
    gl.uniform3fv(u_charges_loc, new Float32Array(u_charges_data));

    gl.bindBuffer(gl.ARRAY_BUFFER, positions_buffer);
    gl.vertexAttribPointer(a_position_loc, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, positions.length / 2);

    update_test_charge();
    gl.useProgram(charge_program);
    gl.uniform3fv(u_charge_ball_translate_loc, new Float32Array(calculate_test_charge_trans()));
    gl.uniformMatrix4fv(u_charge_view_matrix_loc, false, m4.gl_format(matrices.rot));
    gl.uniformMatrix4fv(u_charge_world_matrix_loc, false, m4.gl_format(matrices.world));
    gl.uniform3fv(u_charge_light_loc, new Float32Array(light));
    gl.bindBuffer(gl.ARRAY_BUFFER, charge_positions_buffer);
    gl.vertexAttribPointer(a_charge_position_loc, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, charge_normals_buffer);
    gl.vertexAttribPointer(a_charge_normal_loc, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, ball.length / 3);

    requestAnimationFrame(update);
    update_info();
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
    } else {
        if (!sticked)
        // move mouse charge
        charges[0].position = toclipspace(e.x, e.y);
    }
});

canvas.addEventListener('wheel', e => {charges[0].magnitude += e.deltaY / 200});
canvas.addEventListener('click', e => {charges.push({position: [...charges[0].position], magnitude: charges[0].magnitude})}); // unpacked so creates new object

function update_info(){
    let join = (character) => (a,b) => a + character + b;
    let format = (array, prec) => array.map(x => x.toFixed(prec || 2));
    document.getElementById('info').innerText = [
        ['fps', parseInt(1 / time_delta * 1e3)],
        ['test charge x,y', format(test_charge.position)],
        ['test charge potential (z)', compute_V(...test_charge.position).toFixed(2)],
        ['test charge vx,vy', format(test_charge.velocity.map(c=>c*100))],
        ['mouse charge', charges[0].position.map(c=>c.toFixed(3))]

    ].map(a => a.reduce(join(' = '))).reduce(join('\n'));
}
