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


void main(void) {
  vec3 view_direction = normalize(position_commonspace - cameraPosition);
  vec3 ray_dir = normalize(view_direction);
  vec3 eye = cameraPosition + volume.cameraTarget; // + vec3(0.5, 0.5, 0.5); // move eye to center of volume


  // front face culling (to avoid doubling of colors)
  float a = dot(ray_dir, normals_commonspace);
  if (a < 0.0) {
    discard;
    return;
  }


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
  float alpha = 0.02; // 0.005
	vec3 p = eye + t_hit.x * ray_dir;
  fragColor = vec4(0.0, 0.0, 0.0, 0.0);
	for (float t = t_hit.x; t < t_hit.y; t += dt) {

		// Step 4.1: Sample the volume, and color it by the transfer function.
		// Note that here we don't use the opacity from the transfer function,
		// and just use the sample value as the opacity

    // Pick color from texture.
    vec4 texture_val = texture(propertyTexture, p); //vec3(0.5, 0.5, 0.5));
    float property = texture_val.r;

    vec4 color_map_val = texture(colorMapTexture, vec3(property, 0.5, 0.5)); //vec2(property, 0.5)); 

    if (property > 0.5 && property < 0.6) { // make this interval more transparent.
      alpha /= 2.0;
    }
    vec4 voxel_color = vec4(color_map_val.rgb, alpha);

  
    if (property == 0.0) { // empty voxel
      voxel_color = vec4(0.0, 0.0, 0.0, 0.0002); //juster alpha her for fargen på tomme voxler 
    }
          // if (property == 0.0) {
          //   discard;
          //   return;
          // }



		// Step 4.2: Accumulate the color and opacity using the front-to-back
		// compositing equation
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
