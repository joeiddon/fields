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
#define E_SCALING_FACTOR 0.003;

// consider using structs ?

attribute vec3 a_position; // the z is a 0 or 1 indicating if vector tail or not

// would probably better to pass a uniform of the number of charges used
uniform vec3 u_charges[MAX_CHARGES]; // the z is a 0 or 1 indicating if in use or not

vec2 E_influence(int charge_index) {
    // returns the electric field from the charge at index charge_index
    // in the charges global array
    vec2 r = u_charges[charge_index].xy - a_position.xy;
    vec2 E = r / pow(length(r), 3.0) * E_SCALING_FACTOR;
    E = length(E) > length(r) ? r : E;
    return E;
}

void main(){
    // if this vertex is the tail of a vector, don't need to add the
    // electric field
    if (a_position.z == 1.0) {
        gl_Position = vec4(a_position.xy, 0, 1);
        return;
    }

    vec2 E = vec2(0, 0);

    for (int i = 0; i < MAX_CHARGES; i++){
        // skip charges that are not being used
        if (u_charges[i].z == 0.0) continue;

        E += E_influence(i);
    }

    gl_Position = vec4(a_position.xy + E, 0, 1);
}
`;

let fragment_shader_src = `
precision mediump float;

void main(){
    gl_FragColor = vec4(1, 1, 1, 1);
}
`;
