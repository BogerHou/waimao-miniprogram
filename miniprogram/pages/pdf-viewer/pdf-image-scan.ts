type PdfImageScanOptions = {
  foundCount: number
  statusCode?: number
}

export function shouldContinuePdfImageScan(options: PdfImageScanOptions) {
  return options.statusCode === 200
}
