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
#define OSCILL 3.0
#define PI 3.14159265358979

// consider using structs ?

attribute vec3 a_position;

uniform mat4 u_world_matrix;

// would probably better to pass a uniform of the number of charges used
uniform vec4 u_charges[MAX_CHARGES]; // the w is the magnitude of the charge

varying vec4 color;

float compute_V() {
    float V = 0.0;
    for (int i = 0; i < MAX_CHARGES; i++){
        // skip charges that are not being used
        if (u_charges[i].w == 0.0) continue;
        vec3 r = u_charges[i].xyz - a_position.xyz;
        float Vi = -1.0 * V_SCALING_FACTOR * u_charges[i].w / length(r);
        V += Vi;
    }
    // if (V > V_MAX) V = V_MAX;
    return V;
}

void main(){
    float V = compute_V();

    vec3 point = a_position;
    gl_Position = u_world_matrix * vec4(point, 1);
    gl_PointSize = 2.0;

    float v = V;
    //color = vec4(1, v, 0, 1);
    color = vec4(
        sin(v * OSCILL),
        sin(v * OSCILL + PI * 2.0 / 3.0),
        sin(v * OSCILL + PI * 4.0 / 3.0),
        1
    );

}
`;

let line_vertex_shader_src = `
attribute vec3 a_position;
uniform mat4 u_world_matrix;
varying vec4 color;
void main(){
    gl_Position = u_world_matrix * vec4(a_position, 1);
    color = vec4(1, 1, 1, 1);
}
`

let fragment_shader_src = `
precision mediump float;

varying vec4 color;

void main(){
    gl_FragColor = color;
}
`;
