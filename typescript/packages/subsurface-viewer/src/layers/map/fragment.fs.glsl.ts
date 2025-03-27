const fsShader = `#version 300 es
#define SHADER_NAME map-fragment-shader

precision highp float;

// in vec2 vTexCoord;
// in vec3 cameraPosition_;
// in vec3 normals_commonspace;
// in vec4 position_commonspace;
// in vec4 vColor;

// flat in int vertexIndex;

// in vec3 worldPos;
// in float property;

out vec4 fragColor;

// uniform sampler2D colormap;

// uniform bool isContoursDepth;
// uniform float contourReferencePoint;
// uniform float contourInterval;

// uniform float valueRangeMin;
// uniform float valueRangeMax;
// uniform float colorMapRangeMin;
// uniform float colorMapRangeMax;

// uniform vec3 colorMapClampColor;
// uniform bool isClampColor;
// uniform bool isColorMapClampColorTransparent;
// uniform bool smoothShading;


void main(void) { 
   // geometry.uv = vTexCoord;

   // vec3 normal = normals_commonspace;

   // if (!custom.smoothShading || (normal[0] == 0.0 && normal[1] == 0.0 && normal[2] == 0.0)) {
   //    normal = normalize(cross(dFdx(position_commonspace.xyz), dFdy(position_commonspace.xyz)));
   // }

   // //Picking pass.
   // if (picking.isActive > 0.5 && !(picking.isAttribute > 0.5)) {
   //    fragColor = encodeVertexIndexToRGB(vertexIndex);
   //    return;
   // }

   // vec4 color = vec4(1.0, 1.0, 1.0,  1.0);
   // float propertyValue = property;

   // // This may happen due to GPU interpolation precision causing color artifacts.
   // propertyValue = clamp(propertyValue, custom.valueRangeMin, custom.valueRangeMax);

   // float x = (propertyValue - custom.colorMapRangeMin) / (custom.colorMapRangeMax - custom.colorMapRangeMin);
   // if (x < 0.0 || x > 1.0) {
   //    // Out of range. Use clampcolor.
   //    if (custom.isClampColor) {
   //       color = vec4(custom.colorMapClampColor.rgb, 1.0);
   //    }
   //    else if (custom.isColorMapClampColorTransparent) {
   //       discard;
   //       return;
   //    }
   //    else {
   //       // Use min/max color to clamp.
   //       x = max(0.0, x);
   //       x = min(1.0, x);

   //       color = texture(colormap, vec2(x, 0.5));
   //    }
   // }
   // else {
   //    color = texture(colormap, vec2(x, 0.5));
   // }

   // bool is_contours = custom.contourReferencePoint != -1.0 && custom.contourInterval != -1.0;
   // if (is_contours) {
   //    float val = custom.isContoursDepth ? (abs(worldPos.z) - custom.contourReferencePoint) / custom.contourInterval
   //                                : (propertyValue - custom.contourReferencePoint) / custom.contourInterval;

   //    float f  = fract(val);
   //    float df = fwidth(val);

   //    // keep: float c = smoothstep(df * 1.0, df * 2.0, f); // smootstep from/to no of pixels distance from contour line.
   //    float c = smoothstep(0.0, df * 2.0, f);

   //    color = color * vec4(c, c, c, 1.0);
   // }

   // // Use two sided phong lighting. This has no effect if "material" property is not set.
   // vec3 lightColor = getPhongLightColor(color.rgb, cameraPosition_, position_commonspace.xyz, normal);
   // //vec3 lightColor = getPhongLightColor(color.rgb, project.cameraPosition, position_commonspace.xyz, normal);
   // fragColor = vec4(lightColor, 1.0);

   fragColor = vec4(1.0, 0.0, 0.2, 1.0);
   DECKGL_FILTER_COLOR(fragColor, geometry);
}
`;

export default fsShader;
