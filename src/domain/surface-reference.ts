export type SurfaceReference = {
  designation: string
  value: string
  display: string
  link?: { href: string; label: string }
}

export type SurfaceAssertionPart =
  | { type: 'text'; value: string }
  | { type: 'reference'; reference: SurfaceReference }
