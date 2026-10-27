// Shared GLSL snippets for the render shaders.

export const NOISE = /* glsl */`
float gpHash12( vec2 p ) {
  vec3 p3 = fract( vec3( p.xyx ) * 0.1031 );
  p3 += dot( p3, p3.yzx + 33.33 );
  return fract( ( p3.x + p3.y ) * p3.z );
}
float gpNoise( vec2 p ) {
  vec2 i = floor( p ), f = fract( p );
  vec2 u = f * f * ( 3.0 - 2.0 * f );
  float a = gpHash12( i ), b = gpHash12( i + vec2( 1.0, 0.0 ) );
  float c = gpHash12( i + vec2( 0.0, 1.0 ) ), d = gpHash12( i + vec2( 1.0, 1.0 ) );
  return mix( mix( a, b, u.x ), mix( c, d, u.x ), u.y );
}
float gpFbm( vec2 p ) {
  float s = 0.0, a = 0.5;
  for ( int i = 0; i < 4; i ++ ) { s += a * gpNoise( p ); p = p * 2.03 + vec2( 1.7, 9.2 ); a *= 0.5; }
  return s;
}
`;

// Height field lookup (terrain under water, for depth-based foam).
export const HEIGHT = /* glsl */`
uniform sampler2D gpHeightTex;
uniform vec4 gpHeightBounds; // minX, minZ, 1/sizeX, 1/sizeZ
float gpGround( vec2 xz ) {
  vec2 uv = ( xz - gpHeightBounds.xy ) * gpHeightBounds.zw;
  if ( uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0 ) return -1000.0;
  return texture2D( gpHeightTex, uv ).r;
}
`;
