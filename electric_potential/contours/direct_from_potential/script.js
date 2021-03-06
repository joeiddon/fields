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

let potential_program = misc.create_gl_program(vertex_shader_src, fragment_shader_src);
let line_program = potential_program; //misc.create_gl_program(line_vertex_shader_src, fragment_shader_src);

//set the color we want to clear to
gl.clearColor(0, 0, 0, 1);

let a_position_loc = gl.getAttribLocation(potential_program, 'a_position');
let u_world_matrix_loc = gl.getUniformLocation(potential_program, 'u_world_matrix');
let u_view_matrix_loc = gl.getUniformLocation(potential_program, 'u_view_matrix');
let u_charges_loc = gl.getUniformLocation(potential_program, 'u_charges');
let u_light_loc = gl.getUniformLocation(potential_program, 'u_light');

let a_line_position_loc = gl.getAttribLocation(line_program, 'a_position');
let u_line_world_matrix_loc = gl.getUniformLocation(line_program, 'u_world_matrix');
let u_line_charges_loc = gl.getUniformLocation(line_program, 'u_charges');

gl.enableVertexAttribArray(a_position_loc);
gl.enableVertexAttribArray(a_line_position_loc);

let divisions = 200;
let step = 2 / divisions;

// positions are in charge / grid coordiantes x, y in [-1,1]
// using a sampling method by working up in ints, then dividing to floats
let positions = [];
for (let xx = 0; xx <= divisions; xx ++) {
    for (let yy = 0; yy <= divisions; yy ++) {
        // conver the integer xx and yy into the appropriate floting ranges
        let x = xx / divisions * 2 - 1;
        let y = yy / divisions * 2 - 1;
        positions.push(
                 x, y,
            x+step, y,
            x+step, y+step,
                 x, y,
            x+step, y+step,
                 x, y+step
        );
    }
}

let positions_buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positions_buffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

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

let cam = [0, 1.5, -2]; // issues when cam is up x-axis with panning of space_pitch !!

// space is the grid
let space_yaw = 0;
let space_pitch = 0;

let light = [-0.5, -1.5, 0.8]; // normalised in vertex shader

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

function partial_x(x, y){
    let dfdx = 0;
    for (let charge of charges){
        let d = ((x - charge.position[0]) ** 2 + (y - charge.position[1]) ** 2) ** 0.5;
        if (d == 0) d = 0.0001;
        dfdx += charge.magnitude * (x - charge.position[0]) / (d ** 3);
    }
    return dfdx;
}

function partial_y(x, y){
    let dfdy = 0;
    for (let charge of charges){
        let d = ((x - charge.position[0]) ** 2 + (y - charge.position[1]) ** 2) ** 0.5;
        if (d == 0) d = 0.0001;
        dfdy += charge.magnitude * (y - charge.position[1]) / (d ** 3);
    }
    return dfdy;
}

function gen_potential_at(voltage, x, y) {
    // naming variables inline with the implicit_plotter project
    let f = compute_V;
    let c = voltage;
    let gx = partial_x;
    let gy = partial_y;

    // CONSTANTS :
    //let e = 0.0001; // approximate gradient delta
    let MAX_ITERATIONS = 500; // stops if not back to within half a step of the start coordinate

    let tolerance = 1e-4;
    let newton_raphson_x = function() {
        let iterations = 0;
        while (Math.abs(f(x,y) - c) > tolerance && ++iterations < MAX_ITERATIONS) {
            if (gx(x,y) == 0) return;
            x = x - (f(x, y) - c) / gx(x, y);
        }
        if (iterations == MAX_ITERATIONS) {
            //console.warn('infinite newton raphson caught');
        }
    }
    let newton_raphson_y = function() {
        let iterations = 0;
        while (Math.abs(f(x,y) - c) > tolerance && ++iterations < MAX_ITERATIONS) {
            if (gy(x,y) == 0) return;
            y = y - (f(x, y) - c) / gy(x, y);
        }
        if (iterations == MAX_ITERATIONS) {
            //console.warn('infinite newton raphson caught');
        }
    }

    // ensure start on the curve
    newton_raphson_y();

    let sgn = x => x < 0 ? -1 : 1;

    //console.log('initial x,y = ', [x,y]);

    let points = [[x,y]];

    let s = 0.01;
    let iteration = 0;
    while (++iteration < MAX_ITERATIONS){
        //console.log('iteration =', iteration, 'x =', x, 'y =', y);
        let dx = gx(x, y);
        let dy = gy(x, y);
        if (dx == 0 && dy == 0) {
            //console.warn('potential = ', voltage, 'V: cant step as both partial derivates are zero');
            return false;
        } else if (Math.abs(dy) > Math.abs(dx)){
            //console.log('doing an x step');
            // why not just scale both partial derivatives, both by lambda, say.
            x += s * - sgn(dy); // dont really need the minus here as should just traverse in opp direction
            y += s * dx / dy * sgn(dy);
            newton_raphson_y(); // should this be newton_raphson_x ? doesn't really matter...
        } else {
            //console.log('doing a y step');
            y += s * sgn(dx); // works is take away this minus !
            x += s * dy / dx * -sgn(dx);
            newton_raphson_x();
        }
        points.push([x,y]);

        if (Math.abs(x - points[0][0]) < s / 2 && Math.abs(y - points[0][1]) < s / 2) break;
    }

    if (iteration == MAX_ITERATIONS) {
        //console.warn('max iterations, did not connect to start');
    } else {
        //add final little link to start
        points.push(points[0]);
    }

    return points;
}

function update() {
    let start = performance.now();
    let log_time = s => {
        console.log('TIME FOR', s, '=', performance.now() - start);
        start = performance.now();
    };

    calculate_matrices();

    gl.clear(gl.COLOR_BUFFER_BIT);

    // draw potential
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
    log_time('draw field');

    /*
    // draw lines
    gl.useProgram(line_program);
    gl.uniformMatrix4fv(u_line_world_matrix_loc, false, m4.gl_format(matrices.world));
    gl.uniform3fv(u_line_charges_loc, new Float32Array(u_charges_data));
    let lines_buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, lines_buffer);
    for (let charge of charges)
    for (let V = -1; V < 1; V += 0.1) {
        let points = gen_potential_at(V, charge.position[0] + 0.0001, charge.position[1] + 0.0001); // probably only have to add to y-coordinate since newton raphson y first !
        if (!points) continue;
        let line = points.flat();
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(line), gl.STATIC_DRAW); // change from STATIC DRAW ?
        gl.vertexAttribPointer(a_line_position_loc, 2, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.LINE_LOOP, 0, line.length/2);
    };
    log_time('draw potentials');
    */


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
    } else {
        // move mouse charge
        charges[0].position = toclipspace(e.x, e.y);
    }
});

canvas.addEventListener('wheel', e => {charges[0].magnitude += e.deltaY / 200});
canvas.addEventListener('click', e => {charges.push({position: [...charges[0].position], magnitude: charges[0].magnitude})}); // unpacked so creates new object


