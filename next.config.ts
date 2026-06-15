/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  sassOptions: {
    // Bootstrap 5.3 still uses @import internally; silence the Dart Sass
    // deprecation noise until Bootstrap migrates to @use.
    silenceDeprecations: ['import', 'global-builtin', 'color-functions'],
  },
};

module.exports = nextConfig;
