export default `\
#version 300 es
#define SHADER_NAME graph-layer-fragment-shader

precision highp float;

out vec4 fragColor;

in vec3 vColor;

in vec3 position_commonspace;

in vec3 cameraPosition;

void main(void) {
  // vec3 normal = normals_commonspace;

  // if (!smoothShading) {
     vec3 normal = normalize(cross(dFdx(position_commonspace), dFdy(position_commonspace)));
  //} 

  vec3 lightColor = lighting_getLightColor(vColor, cameraPosition, position_commonspace, normal);
  fragColor = vec4(lightColor, 1.0);

  //fragColor = vec4(vColor, 1.0);
}
`;
