export default `\
#version 300 es
#define SHADER_NAME graph-layer-axis-vertex-shader

precision highp float;

in vec3 positions;
in vec3 colors;

in float myMds;
out float myMds_;

out vec3 vColor;

out vec3 cameraPosition;
out vec3 position_commonspace;

void main(void) {
   myMds_ = myMds;

   cameraPosition = project.cameraPosition; //project_uCameraPosition;

   position_commonspace = project_position(positions);

   vColor = colors;

   gl_Position = project_common_position_to_clipspace(vec4(position_commonspace, 0.0));
}
`;
