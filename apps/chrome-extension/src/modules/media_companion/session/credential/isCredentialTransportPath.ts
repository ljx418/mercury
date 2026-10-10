const exactCredentialPaths = new Set([
  "/v1/media/credential-channels",
  "/v1/media/credential-leases"
]);

export function isCredentialTransportPath(path: string): boolean {
  const pathname = path.split(/[?#]/, 1)[0];
  return exactCredentialPaths.has(pathname) || /^\/v1\/media\/credential-leases\/pcl_[a-f0-9]{32}$/.test(pathname);
}
