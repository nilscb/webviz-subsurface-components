const gridVertex = `#version 300 es
#define SHADER_NAME graph-layer-axis-vertex-shader

precision highp float;

in vec3 positions;
in vec3 normals;

out vec3 normals_commonspace;
out vec3 position_commonspace;
out vec3 cameraPosition;

void main(void) {
   vec3 postion = positions;
   //position_commonspace = vec4(project_position(postion), 0.0);
   position_commonspace = project_position(positions);

   normals_commonspace = normals;
   cameraPosition = project_uCameraPosition;

   gl_Position = project_common_position_to_clipspace(vec4(position_commonspace, 0.0));
}
`;

export default gridVertex;
