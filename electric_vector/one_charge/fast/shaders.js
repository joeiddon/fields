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
attribute vec3 a_position; // the z is a 0 or 1 indicating if vector tail or not
attribute vec2 a_charge_pos;

void main(){
    // could have used an if statement to check if (a_position.z == 1.0) ...

    vec2 r = a_charge_pos - a_position.xy;
    vec2 E = r / pow(length(r), 3.0) * 0.003;

    E = length(E) > length(r) ? r : E;

    gl_Position = vec4(
        a_position.xy + a_position.z * E,
        0,
        1);
}
`;

let fragment_shader_src = `
precision mediump float;

void main(){
    gl_FragColor = vec4(1, 1, 1, 1);
}
`;
