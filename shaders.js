'use strict';

/*
 * Language is called OpenGL ES Shader Language or GLSL
 * for short.
 * See: https://www.khronos.org/files/webgl/webgl-reference-card-1_0.pdf
 * and: https://www.khronos.org/files/opengles_shading_language.pdf
 *
 * http://learnwebgl.brown37.net/12_shader_language/glsl_control_structures.html
 */

let vertex_shader_src = `
//identifier prefixes like a_ and u_ signify types

#define MAX_CHARGES 50
#define V_SCALING_FACTOR 0.04
#define V_MAX 0.8
#define OSCILL 15.0
#define PI 3.14159265358979

// consider using structs ?

attribute vec2 a_position;

uniform mat4 u_matrix;

// would probably better to pass a uniform of the number of charges used
uniform vec3 u_charges[MAX_CHARGES]; // the z is a 0 or 1 indicating if in use or not

varying vec4 color;

float V_influence(int charge_index) {
    // returns the electric potential from the charge at index charge_index
    // in the charges global array
    vec2 r = u_charges[charge_index].xy - a_position.xy;
    float V = 1.0 / length(r) * V_SCALING_FACTOR;
    return V;
}

void main(){
    float V = 0.0;

    for (int i = 0; i < MAX_CHARGES; i++){
        // skip charges that are not being used
        if (u_charges[i].z == 0.0) continue;

        V += V_influence(i);
    }

    if (V > V_MAX) V = V_MAX;

    gl_Position = u_matrix * vec4(a_position.x, V, a_position.y, 1);

    float v = V;
    color = vec4(
        sin(v * OSCILL) * (0.2 + v),
        sin(v * OSCILL + PI * 2.0 / 3.0) * (0.2 + v),
        sin(v * OSCILL + PI * 4.0 / 3.0) * (0.3 + v),
        1
    );
    //color = vec4(v, 0.1, 0.1, 1);
}
`;

let fragment_shader_src = `
precision mediump float;

varying vec4 color;

void main(){
    gl_FragColor = color;
}
`;
