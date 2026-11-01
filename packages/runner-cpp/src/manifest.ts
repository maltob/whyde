export interface CppToolchainArtifact {
  name: string;
  url: string;
  sha256: string;
  sizeBytes: number;
}

export interface CppToolchainManifest {
  version: string;
  compiler: CppToolchainArtifact;
  linker: CppToolchainArtifact;
  sysrootHeaders: CppToolchainArtifact;
  standardLibraries: CppToolchainArtifact;
  license: string;
  defaultStandard: 'c++17' | 'c++20';
}

export const DEFAULT_CPP_TOOLCHAIN_MANIFEST: CppToolchainManifest = {
  version: '18.1.8',
  compiler: {
    name: 'clang.wasm',
    url: './runtimes/cpp/clang.wasm',
    sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    sizeBytes: 24500000,
  },
  linker: {
    name: 'lld.wasm',
    url: './runtimes/cpp/lld.wasm',
    sha256: 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb',
    sizeBytes: 12800000,
  },
  sysrootHeaders: {
    name: 'wasi-sysroot-headers.tar.gz',
    url: './runtimes/cpp/wasi-sysroot-headers.tar.gz',
    sha256: '4e07408562bedb8b60ce05c1decfe3ad16b72230967de01f640b7e4729b49fce',
    sizeBytes: 4200000,
  },
  standardLibraries: {
    name: 'libcxx.a',
    url: './runtimes/cpp/libcxx.a',
    sha256: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
    sizeBytes: 3100000,
  },
  license: 'Apache-2.0 WITH LLVM-exception',
  defaultStandard: 'c++17',
};
