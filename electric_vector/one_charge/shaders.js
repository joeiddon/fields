'use strict';

/*
 * Language is called OpenGL ES Shader Language or GLSL
 * for short.
 * See: https://www.khronos.org/files/webgl/webgl-reference-card-1_0.pdf
 * and: https://www.khronos.org/files/opengles_shading_language.pdf
 *
 */

let vertex_shader_src = `
//identifier prefixes like a_ and u_ signify types

//rendering verticies
attribute vec2 a_position;

void main(){
    gl_Position = vec4(a_position, 0, 1);
}
`;

let fragment_shader_src = `
precision mediump float;

void main(){
    gl_FragColor = vec4(1, 1, 1, 1);
}
`;
