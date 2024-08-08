const fragmentShader = `#version 300 es
#define SHADER_NAME graph-layer-fragment-shader

precision highp float;

in vec3 normals_commonspace;
in vec3 position_commonspace;  // XXX bare pruke position??? ikke commonspace greiene..
in vec3 cameraPosition;

out vec4 fragColor;

uniform vec4 uColor;

void main(void) {

   vec3 view_direction = normalize(cameraPosition - position_commonspace);

  //float a = dot(cameraPosition, position_commonspace.xyz);
  //float a = dot(cameraPosition, normals_commonspace.xyz);
  float a = dot(view_direction, normals_commonspace.xyz);
  
  if (a > 0.0) {
    fragColor  = vec4(0.0, 1.0, 0.0, 1.0); 
    //discard;
    return;
  }


  fragColor = uColor;
}
`;

export default fragmentShader;


// vec3 lightColor = getPhongLightColor(color.rgb, cameraPosition, position_commonspace.xyz, normal);

// vec3 getPhongLightColor(vec3 surfaceColor, vec3 light_direction, vec3 view_direction, vec3 normal_worldspace, vec3 color) {
    
//   vec3 halfway_direction = normalize(light_direction + view_direction);   
//   float lambertian = abs(dot(light_direction, normal_worldspace));

//   float specular_angle = abs(dot(normal_worldspace, halfway_direction));

//   float specular = pow(specular_angle, lighting_uShininess);       
//   return (lambertian * lighting_uDiffuse * surfaceColor + specular * lighting_uSpecularColor) * color;    
// }