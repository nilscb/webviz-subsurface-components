const fragmentShader = `#version 300 es
#define SHADER_NAME graph-layer-fragment-shader

precision highp float;

flat in vec3 normals_commonspace;
in vec3 position_commonspace;
flat in vec3 cameraPosition;

out vec4 fragColor;

uniform vec4 uColor;

precision highp sampler3D;
uniform sampler3D propertyTexture;
uniform sampler3D colorMapTexture;


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

// GLSL Intersection Function Example
float intersectPlane(vec3 rayOrigin, vec3 rayDir, vec3 planeNormal, float planeDist) {
    float denom = dot(rayDir, planeNormal);
    if (abs(denom) > 1e-6) { // Check if not parallel
        return (planeDist - dot(rayOrigin, planeNormal)) / denom;
    }
    return -1.0; // No intersection
}


void main(void) {
  // plane definition
  float plane_d = volume.plane_offset; // distance from origin
  vec3 plane_n = normalize(vec3(1.0, 1.0, 1.0)); // normal vector


  vec3 view_direction = normalize(position_commonspace - cameraPosition);
  vec3 ray_dir = normalize(view_direction);
  vec3 eye = cameraPosition + volume.cameraTarget;


  // front face culling (to avoid doubling of colors)
  float a = dot(ray_dir, normals_commonspace);
  if (a < 0.0) {
    discard;
    return;
  }

  // If intersection wtih cut plane, calculate color at intersection and return.
  bool is_plane = false;
  vec4 cut_plane_color;
  float t_plane = intersectPlane(eye, ray_dir, plane_n, plane_d);
	vec3 p_plane = eye + t_plane * ray_dir; // intersection point
	if (p_plane.x >= 0.0 && p_plane.x <= 1.0 &&
      p_plane.y >= 0.0 && p_plane.y <= 1.0 &&
      p_plane.z >= 0.0 && p_plane.z <= 1.0) {
		vec4 texture_val = texture(propertyTexture, p_plane);
		float property = texture_val.r;
		if (property != 0.0) {
    	is_plane = true;
      vec4 color_map_val = texture(colorMapTexture, vec3(property, 0.5, 0.5));
      cut_plane_color = vec4(color_map_val.rgb, 1.0);
		}
	}



  // Compute intersection of ray with unit cube
  vec2 t_hit = intersect_box(eye, ray_dir);
  bool hit = t_hit.x < t_hit.y; // XXX tror det er e bug i orginalen  her den bruker ">"
  if (!hit) {
    discard;
    return;
  }

  // We don't want to sample voxels behind the eye if it's
  // inside the volume, so keep the starting point at or in front
  // of the eye
  t_hit.x = max(t_hit.x, 0.0);

  // Compute the step size to march through the volume grid
  vec3 dt_vec = (1.0 / (vec3(1.0, 1.0, 1.0)) * abs(ray_dir));
  float dt = 0.0005; //min(dt_vec.x, min(dt_vec.y, dt_vec.z));  //0.0005; //


  // Starting from the entry point, march the ray through the volume and sample it.
  float alpha = volume.alpha; // 0.02
  vec3 p = eye + t_hit.x * ray_dir;
  fragColor = vec4(0.0, 0.0, 0.0, 0.0);
  for (float t = t_hit.x; t < t_hit.y; t += dt) {
    // Step 4.1: Sample the volume, and color it by the transfer function.
    // Note that here we don't use the opacity from the transfer function,
    // and just use the sample value as the opacity

    // Pick color from texture.
    vec4 texture_val = texture(propertyTexture, p);
    float property = texture_val.r;

    vec4 color_map_val = texture(colorMapTexture, vec3(property, 0.5, 0.5));
    vec4 voxel_color = vec4(color_map_val.rgb, alpha);

    // Make voxels on plane positive side transparent.
    float e = plane_n[0] * p[0] + plane_n[1] * p[1] + plane_n[2] * p[2] - plane_d;
    if (property == 0.0 || e > 0.0 ) { // empty voxel.  e> 0 -> p on positive side of plane
      voxel_color = vec4(0.0, 0.0, 0.0, 0.00015); //juster alpha her for fargen på tomme voxler
    }

    // If we have reached the cut plane, use the cut plane color and break.
    if (t > t_plane && is_plane) {
      voxel_color = cut_plane_color;
      // Accumulate the color and opacity using the front-to-back compositing equation.
      fragColor.rgb += (1.0 - fragColor.a) * voxel_color.a * voxel_color.rgb;
      fragColor.a += (1.0 - fragColor.a) * voxel_color.a;
      break;
    }

    // Accumulate the color and opacity using the front-to-back compositing equation.
    fragColor.rgb += (1.0 - fragColor.a) * voxel_color.a * voxel_color.rgb;
    fragColor.a += (1.0 - fragColor.a) * voxel_color.a;

    // Optimization: break out of the loop when the color is near opaque
    if (fragColor.a >= 0.95) {
      break;
    }

    p += ray_dir * dt;
  }
}
`;

export default fragmentShader;
