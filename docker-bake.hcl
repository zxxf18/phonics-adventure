variable "IMAGE" {
  default = "phonics-adventure:latest"
}

group "default" {
  targets = ["release"]
}

target "release" {
  context = "."
  dockerfile = "Dockerfile"
  tags = [IMAGE]
  platforms = ["linux/amd64", "linux/arm64"]
}

target "local-arm64" {
  inherits = ["release"]
  platforms = ["linux/arm64"]
  output = ["type=docker"]
}

target "local-amd64" {
  inherits = ["release"]
  platforms = ["linux/amd64"]
  output = ["type=docker"]
}
