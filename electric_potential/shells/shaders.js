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
attribute vec3 a_position;
uniform mat4 u_world_matrix;
varying vec4 color;

void main(){
    vec3 point = a_position;
    gl_Position = u_world_matrix * vec4(point, 1);

    //color = vec4(1, 0, 0, 0.5);
    color = vec4(1, a_position.x / 5.0, 1.0 - a_position.z / 5.0, 0.5);
}
`;

let line_vertex_shader_src = `
attribute vec3 a_position;
uniform mat4 u_world_matrix;
varying vec4 color;

void main(){
    gl_Position = u_world_matrix * vec4(a_position, 1);
    color = vec4(0.5, 0.5, 0.5, 1);
}
`

let fragment_shader_src = `
precision mediump float;

varying vec4 color;

void main(){
    gl_FragColor = color;
}
`;
