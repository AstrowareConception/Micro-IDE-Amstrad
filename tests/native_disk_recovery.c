/* Manual real-disk observation. Caller supplies ROMs and disk; no game is embedded. */
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include "../packages/emulator/src/cpc_bridge.c"

static void load(const char *path, uint8_t *buffer, int size) {
    FILE *file = fopen(path, "rb"); assert(file);
    assert(fread(buffer, 1, size, file) == (size_t)size); assert(fgetc(file) == EOF); fclose(file);
}
static void wait_seconds(int seconds) {
    assert(seconds >= 0 && seconds <= 120);
    for (int i = 0; i < seconds * 50; i++) cpc_bridge_step(20000);
}
static void type(const char *text) {
    for (const char *p = text; *p; p++) {
        cpc_bridge_key(*p, 1); for (int i = 0; i < 6; i++) cpc_bridge_step(10000);
        cpc_bridge_key(*p, 0); for (int i = 0; i < 6; i++) cpc_bridge_step(10000);
    }
}
static void capture(const char *prefix, int stage) {
    char path[4096]; assert(snprintf(path, sizeof(path), "%s-%d.ppm", prefix, stage) < (int)sizeof(path));
    FILE *file = fopen(path, "wb"); assert(file);
    const int width = cpc_bridge_width(), height = cpc_bridge_height(), stride = cpc_bridge_stride();
    fprintf(file, "P6\n%d %d\n255\n", width, height);
    const uint8_t *pixels = cpc_bridge_frame(); const uint32_t *palette = cpc_bridge_palette();
    for (int y = 0; y < height; y++) for (int x = 0; x < width; x++) {
        const uint32_t color = palette[pixels[y * stride + x]];
        const uint8_t rgb[3] = {color & 255, (color >> 8) & 255, (color >> 16) & 255};
        assert(fwrite(rgb, 1, 3, file) == 3);
    }
    fclose(file); printf("{\"stage\":%d,\"pc\":%u,\"peek9000\":%d}\n", stage, machine.cpu.pc, cpc_bridge_peek(0x9000));
}
int main(int argc, char **argv) {
    assert(argc >= 9 && argc % 2 == 1);
    uint8_t os[16384], basic[16384], amsdos[16384]; uint8_t *disk = malloc(DISK_BYTES); assert(disk);
    load(argv[1], os, 16384); load(argv[2], basic, 16384); load(argv[3], amsdos, 16384); load(argv[4], disk, DISK_BYTES);
    assert(cpc_bridge_init(os, 16384, basic, 16384, amsdos, 16384) == CPC_OK);
    wait_seconds(5); assert(cpc_bridge_mount(disk, DISK_BYTES) == CPC_OK);
    char command[40]; assert(snprintf(command, sizeof(command), "RUN\"%s\"\r", argv[5]) < (int)sizeof(command)); type(command);
    for (int i = 7; i < argc; i += 2) { wait_seconds(atoi(argv[i])); capture(argv[6], (i - 7) / 2); type(argv[i + 1]); }
    cpc_bridge_dispose(); free(disk); return 0;
}
