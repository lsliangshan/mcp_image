declare module "icon-gen" {
  const icongen: (
    src: string,
    dest: string,
    options: {
      report: boolean;
      ico?: {
        sizes?: number[];
        name?: string;
      };
      icns?: {
        sizes?: number[];
        name?: string;
      };
      favicon?: {
        name?: string;
        pngSizes?: number[];
        icoSizes?: number[];
      };
    }
  ) => Promise<void>;
  export default icongen;
}
