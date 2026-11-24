FROM debian:trixie
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl git build-essential clang llvm lld jq xz-utils nodejs npm && rm -rf /var/lib/apt/lists/*
ENV RUSTUP_TOOLCHAIN=nightly-2026-10-22 PATH=/root/.cargo/bin:$PATH
RUN curl -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain nightly-2026-10-22 -c rust-src -t wasm32-unknown-unknown
RUN curl -sL https://github.com/rustwasm/wasm-bindgen/releases/download/0.2.100/wasm-bindgen-0.2.100-x86_64-unknown-linux-musl.tar.gz | tar xz -C /tmp && cp /tmp/wasm-bindgen-0.2.100-x86_64-unknown-linux-musl/wasm-bindgen /usr/local/bin/
RUN curl -sL https://github.com/WebAssembly/binaryen/releases/download/version_133/binaryen-version_133-x86_64-linux.tar.gz | tar xz -C /opt && ln -s /opt/binaryen-version_133/bin/wasm-opt /usr/local/bin/wasm-opt
WORKDIR /src
