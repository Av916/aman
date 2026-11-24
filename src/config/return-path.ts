export function turfReturnPath(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length > 1200 ||
    !/^\/turfs(?:\/[a-z0-9-]+)?(?:\?[^#\\]*)?$/.test(value)
  )
    return;
  return value;
}
