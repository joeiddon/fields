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

attribute vec2 a_position;

uniform mat4 u_world_matrix;
uniform mat4 u_view_matrix;

uniform vec3 u_light;

// would probably better to pass a uniform of the number of charges used
uniform vec3 u_charges[MAX_CHARGES]; // the z is the magnitude of the charge

varying vec4 color;

float compute_V() {
    float V = 0.0;
    for (int i = 0; i < MAX_CHARGES; i++){
        // skip charges that are not being used
        if (u_charges[i].z == 0.0) continue;
        vec2 r = u_charges[i].xy - a_position.xy;
        float Vi = -1.0 * V_SCALING_FACTOR * u_charges[i].z / length(r);
        V += Vi;
    }
    // if (V > V_MAX) V = V_MAX;
    return V;
}

vec3 compute_normal() {
    float dfdx = 0.0;
    float dfdy = 0.0;
    for (int i = 0; i < MAX_CHARGES; i++){
        // skip charges that are not being used
        if (u_charges[i].z == 0.0) continue;
        vec2 r = u_charges[i].xy - a_position.xy;
        dfdx += u_charges[i].z * (a_position.x - u_charges[i].x) / pow(length(r), 3.0);
        dfdy += u_charges[i].z * (a_position.y - u_charges[i].y) / pow(length(r), 3.0);
    }
    vec3 n = vec3(-dfdx, 1, -dfdy);
    return n / length(n);
}

void main(){
    float V = compute_V();

    vec3 vertex = vec3(a_position.x, V, a_position.y);
    gl_Position = u_world_matrix * vec4(vertex, 1);

    vec3 reflected_ray = -normalize(u_light);
    vec3 n = compute_normal();
    n = (u_view_matrix * vec4(n, 1)).xyz;
    float intensity = dot(reflected_ray, n);
    if (intensity < 0.0) intensity = 0.0;
    //intensity = 0.8;
    //color = vec4(1, 0, 0, 1);
    float v = V;
    color = vec4(
        sin(v * OSCILL),
        sin(v * OSCILL + PI * 2.0 / 3.0),
        sin(v * OSCILL + PI * 4.0 / 3.0),
        1
    );
    //color = vec4(1, 0.8-0.5*v, 0, 1);
    color.xyz *= (0.6 + 0.4 * intensity);
}
`;

let line_vertex_shader_src = `
//identifier prefixes like a_ and u_ signify types

#define MAX_CHARGES 50
#define V_SCALING_FACTOR 0.04
#define V_MAX 0.8
#define OSCILL 3.0
#define PI 3.14159265358979

// consider using structs ?

attribute vec2 a_position;

uniform mat4 u_world_matrix;

// would probably better to pass a uniform of the number of charges used
uniform vec3 u_charges[MAX_CHARGES]; // the z is the magnitude of the charge

varying vec4 color;

float compute_V() {
    float V = 0.0;
    for (int i = 0; i < MAX_CHARGES; i++){
        // skip charges that are not being used
        if (u_charges[i].z == 0.0) continue;
        vec2 r = u_charges[i].xy - a_position.xy;
        float Vi = -1.0 * V_SCALING_FACTOR * u_charges[i].z / length(r);
        V += Vi;
    }
    // if (V > V_MAX) V = V_MAX;
    return V;
}

void main(){
    // NO NEED TO COMPUTE POTENTIAL AS PLOTTING AT A FIXED POTETNTIAL - PASS IN
    // AS A UNIFORM
    float V = compute_V();

    vec3 vertex = vec3(a_position.x, V, a_position.y);
    vertex.y += 0.001;
    gl_Position = u_world_matrix * vec4(vertex, 1);
    color = vec4(1, 1, 1, 1);
}
`;

let fragment_shader_src = `
precision mediump float;

varying vec4 color;

void main(){
    //add bands of color for contours?
    gl_FragColor = color;
}
`;
