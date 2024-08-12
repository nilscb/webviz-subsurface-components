const fragmentShader = `#version 300 es
#define SHADER_NAME graph-layer-fragment-shader

precision highp float;

flat in vec3 normals_commonspace;
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
  ray_dir = normalize(ray_dir);  // XXX trengs kanskje ikke. nei det gjode den ikke...
  vec3 eye = cameraPosition + vec3(0.5, 0.5, 0.5); // tranlserte den litt ned jeg for å fåden i midten...

  //vec3 n = normalize(normals_commonspace);

  // front face culling
  float a = dot(ray_dir, normals_commonspace);
  if (a < 0.0) {
    //fragColor  = vec4(0.0, 0.0, 1.0, 1.0); 
    discard;
    return;
  }


  vec2 t_hit = intersect_box(eye, ray_dir);
  bool hit = t_hit.x < t_hit.y; // XXX tror det er e bug i orginalen  her den bruker ">"
	if (!hit) {
    //fragColor  = vec4(1.0, 0.0, 0.0, 1.0); 
    //return;
		discard;
	}


	// We don't want to sample voxels behind the eye if it's
	// inside the volume, so keep the starting point at or in front
	// of the eye
	t_hit.x = max(t_hit.x, 0.0);

  // Step 3: Compute the step size to march through the volume grid
  vec3 dt_vec = (1.0 / (vec3(1.0, 1.0, 1.0)) * abs(ray_dir));
  float dt = 0.01; //min(dt_vec.x, min(dt_vec.y, dt_vec.z));


  // DEBUG XXX
  // //bool in_interval = t_hit.x > 2.25 && t_hit.x < 3.4;
  // //bool in_interval = abs(ray_dir)) > 0.9  && abs(ray_dir)) < 1.1;
  // //float dt = dt_vec.z;
  // bool in_interval = dt > 0.0  && dt < 0.2;
  // // bool in_interval = t_hit.x < t_hit.y;
  // fragColor  = vec4(!in_interval ? 1.0 : 0.0, in_interval ? 1.0 : 0.0, 0.0,  1.0); //vec4(0.0, t_hit.x > t_hit.y ? 1.0 : 0.0,  0.0, 1.0); 
  // return;



	// Step 4: Starting from the entry point, march the ray through the volume
	// and sample it
	vec3 p = eye + t_hit.x * ray_dir;
  fragColor = vec4(0.0, 0.0, 0.0, 0.0);
	for (float t = t_hit.x; t < t_hit.y; t += dt) {

		// Step 4.1: Sample the volume, and color it by the transfer function.
		// Note that here we don't use the opacity from the transfer function,
		// and just use the sample value as the opacity

		// float val = texture(volume, p).r;
    vec4 val_color;
    float val = 0.0;
    if ( (p[0] > 0.25 && p[0] < 0.75)
      && (p[1] > 0.25 && p[1] < 0.75)
      && (p[2] > 0.25 && p[2] < 0.75)) {
      val = 0.025;
      val_color = vec4(1.0, 0.0, 1.0,  val); 
    }
    else if ( (p[0] > 0.0 && p[0] < 0.25)
      && (p[1] > 0.0 && p[1] < 0.25)
      && (p[2] > 0.0 && p[2] < 0.25)) {
      val = 1.0;
      val_color = vec4(0.0, 0.0, 1.0,  val); 
    }
    else {
      val = 0.0;
      val_color = vec4(0.0, 0.0, 0.0,  val); 
    }


    // float dist = length(p - vec3(0.5, 0.5, 0.5));
    // float val = exp(-0.5 * ((dist * dist) / 0.01));
    // vec4 val_color = vec4(0.0, 1.0, 1.0,  val); //// vec4(texture(transfer_fcn, vec2(val, 0.5)).rgb, val);
    // if (dist < 0.2) {
    //   val = 1.0;
    //   val_color = vec4(1.0, 0.0, 1.0,  val);
    // }

	

		// Step 4.2: Accumulate the color and opacity using the front-to-back
		// compositing equation
		fragColor.rgb += (1.0 - fragColor.a) * val_color.a * val_color.rgb;
		fragColor.a += (1.0 - fragColor.a) * val_color.a;

		// Optimization: break out of the loop when the color is near opaque
		if (fragColor.a >= 0.95) {
			break;
		}

		p += ray_dir * dt;
	}  
}
`;

export default fragmentShader;
