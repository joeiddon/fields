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

uniform mat4 u_world_matrix;
uniform mat4 u_view_matrix;

// would probably better to pass a uniform of the number of charges used
uniform vec3 u_charges[MAX_CHARGES]; // the z is a 0 or 1 indicating if in use or not

varying vec4 color;

float compute_V() {
    float V = 0.0;
    for (int i = 0; i < MAX_CHARGES; i++){
        // skip charges that are not being used
        if (u_charges[i].z == 0.0) continue;
        vec2 r = u_charges[i].xy - a_position.xy;
        float Vi = 1.0 / length(r) * V_SCALING_FACTOR;
        V += Vi;
    }
    if (V > V_MAX) V = V_MAX;
    return V;
}

vec3 compute_normal() {
    float dfdx = 0.0;
    float dfdy = 0.0;
    for (int i = 0; i < MAX_CHARGES; i++){
        // skip charges that are not being used
        if (u_charges[i].z == 0.0) continue;
        vec2 r = u_charges[i].xy - a_position.xy;
        dfdx += - (a_position.x - u_charges[i].x) / pow(length(r), 3.0);
        dfdy += - (a_position.y - u_charges[i].y) / pow(length(r), 3.0);
    }
    vec3 n = vec3(dfdx, 1, -dfdy);
    return n / length(n);
}

void main(){
    float V = compute_V();

    vec3 vertex = vec3(a_position.x, V, a_position.y);
    gl_Position = u_world_matrix * vec4(vertex, 1);


    vec3 light = vec3(-0.05, -19.0, 0);
    light = normalize(u_view_matrix * vec4(light, 1)).xyz;
    color = vec4(0.5 * (a_position.x + 1.0), 0.5 * (a_position.y + 1.0), 0, 1);
    color.xyz *= (1.0 + 0.0 * dot(light, -compute_normal()));
    /*
    float v = V;
    color = vec4(
        sin(v * OSCILL) * (0.2 + v),
        sin(v * OSCILL + PI * 2.0 / 3.0) * (0.2 + v),
        sin(v * OSCILL + PI * 4.0 / 3.0) * (0.3 + v),
        1
    );
    */
}
`;

let fragment_shader_src = `
precision mediump float;

varying vec4 color;

void main(){
    gl_FragColor = color;
}
`;
