const gridVertex = `#version 300 es
#define SHADER_NAME graph-layer-axis-vertex-shader

precision highp float;

in vec3 positions;
in vec3 normals;

flat out vec3 normals_commonspace;
out vec3 position_commonspace;
flat out vec3 cameraPosition;

void main(void) {

   position_commonspace = project_position(positions);

   normals_commonspace = normals;
   cameraPosition = project_uCameraPosition;

   gl_Position = project_common_position_to_clipspace(vec4(position_commonspace, 0.0));
}
`;

export default gridVertex;

// C:\Users\nilscb\nilscb\tmp\deck.gl-master\deck.gl-master\modules\core\src\shaderlib\project\project.glsl.js
// vec4 project_common_position_to_clipspace(vec4 position, mat4 viewProjectionMatrix, vec4 center) {
//    return viewProjectionMatrix * position + center;
//  }