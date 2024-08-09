const fragmentShader = `#version 300 es
#define SHADER_NAME graph-layer-fragment-shader

precision highp float;

in vec3 normals_commonspace;
in vec3 position_commonspace;  // XXX bare pruke position??? ikke commonspace greiene..
flat in vec3 cameraPosition;

out vec4 fragColor;

uniform vec4 uColor;

vec2 intersect_box(vec3 orig, vec3 dir) {
	const vec3 box_min = vec3(0);
	const vec3 box_max = vec3(1);
	vec3 inv_dir = 1.0 / dir;
	vec3 tmin_tmp = (box_min - orig) * inv_dir;
	vec3 tmax_tmp = (box_max - orig) * inv_dir;
	vec3 tmin = min(tmin_tmp, tmax_tmp);
	vec3 tmax = max(tmin_tmp, tmax_tmp);
	float t0 = max(tmin.x, max(tmin.y, tmin.z));
	float t1 = min(tmax.x, min(tmax.y, tmax.z));
	return vec2(t0, t1);
}


void main(void) {

  vec3 view_direction = normalize(cameraPosition - position_commonspace);
  vec3 ray_dir = -view_direction;
  vec3 eye = cameraPosition;

  // vec3 n = normalize(normals_commonspace);
  // fragColor  = vec4(n[2], n[2], n[2], 1.0); 
  // return;

  // front face culling
  float a = dot(ray_dir, normals_commonspace);
  if (a < 0.0) {
    //fragColor  = vec4(0.0, 1.0, 0.0, 1.0); 
    discard;
    return;
  }

  // vec2 t_hit = intersect_box(eye, ray_dir);
  // bool hit = t_hit.x <= t_hit.y;
	// if (!hit) {
  //   fragColor  = vec4(1.0, 0.0, 0.0, 1.0); 
  //   return;
	// 	discard;
	// }




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