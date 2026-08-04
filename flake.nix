{
  description = "Axone Surface development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";
  };

  outputs =
    { nixpkgs, ... }:
    let
      supportedSystems = [
        "aarch64-darwin"
        "x86_64-darwin"
        "x86_64-linux"
        "aarch64-linux"
      ];

      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;
      nixpkgsFor =
        system:
        import nixpkgs {
          inherit system;
          config.allowDeprecatedx86_64Darwin = true;
        };
    in
    {
      devShells = forAllSystems (
        system:
        let
          pkgs = nixpkgsFor system;
        in
        {
          default = pkgs.mkShell {
            packages = [
              pkgs.codespell
              pkgs.git
              pkgs.markdownlint-cli2
              pkgs.nodejs_24
              pkgs.pnpm
              pkgs.python3
              pkgs.rtk
              pkgs.shellcheck
              pkgs.typescript-language-server
              pkgs.vue-language-server
              pkgs.yamllint
            ];
            shellHook = ''
              echo "Axone Surface development environment loaded"
            '';
          };
        }
      );
    };
}
