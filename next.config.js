module.exports = {
  experimental: { serverComponentsExternalPackages: ["nodemailer"] },
  async redirects() {
    return [
      { source: "/dashboard.html", destination: "/dashboard", permanent: false },
      { source: "/audit.html", destination: "/audit", permanent: false },
    ];
  },
};
