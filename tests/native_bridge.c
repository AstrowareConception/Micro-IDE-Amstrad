/* Transport tests with ORIGINAL synthetic ROM JP 0. No CPC boot claim. */
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "../packages/emulator/src/cpc_bridge.c"

int main(int argc, char** argv) {
    assert(argc == 2);
    uint8_t* disk = malloc(DISK_BYTES + 1);
    uint8_t* result = malloc(DISK_BYTES);
    assert(disk && result);
    FILE* input = fopen(argv[1], "rb"); assert(input);
    assert(fread(disk, 1, DISK_BYTES + 1, input) == DISK_BYTES); fclose(input);
    uint8_t rom[16384] = { 0xc3, 0, 0 }; /* JP 0 forever */
    assert(cpc_bridge_step(1) == CPC_ERR_STATE);
    assert(cpc_bridge_init(NULL, 16384, rom, 16384, rom, 16384) == CPC_ERR_INPUT);
    assert(cpc_bridge_init(rom, 16383, rom, 16384, rom, 16384) == CPC_ERR_INPUT);
    assert(cpc_bridge_init(rom, 16384, rom, 16384, rom, 16384) == CPC_OK);
    assert(cpc_bridge_mount(disk, DISK_BYTES) == CPC_OK);
    assert(cpc_bridge_export(result, DISK_BYTES) == DISK_BYTES);
    assert(memcmp(result, disk, DISK_BYTES) == 0);
    /* This uses the actual upstream drive write function, not a copied buffer. */
    machine.fdd.motor_on = true;
    assert(fdd_seek_track(&machine.fdd, 0) == FDD_RESULT_SUCCESS);
    assert(fdd_seek_sector(&machine.fdd, 0, 0, 0, 0xc5, 2) == FDD_RESULT_SUCCESS);
    assert(fdd_write(&machine.fdd, 0, 42) == FDD_RESULT_SUCCESS);
    assert(cpc_bridge_export(result, DISK_BYTES) == DISK_BYTES);
    assert(result[256 + 256 + 4 * 512] == 42);
    assert(disk[256 + 256 + 4 * 512] != 42); /* build disk untouched */
    for (int size = 0; size <= DISK_BYTES + 1; size++) {
        if (size != DISK_BYTES) assert(cpc_bridge_mount(disk, size) == CPC_ERR_DISK);
    }
    const int offsets[] = { 0, 0x30, 0x31, 0x32, 0x33, 256, 272, 273, 276, 277, 280, 281, 282, 283, 284, 285 };
    for (size_t index = 0; index < sizeof(offsets)/sizeof(offsets[0]); index++) {
        int p = offsets[index]; uint8_t saved = disk[p];
        for (int value = 0; value < 256; value++) if (value != saved) {
            disk[p] = (uint8_t)value;
            assert(cpc_bridge_mount(disk, DISK_BYTES) == CPC_ERR_DISK);
        }
        disk[p] = saved;
    }
    /* Validation fails before insertion: existing mounted state is retained. */
    assert(cpc_bridge_export(result, DISK_BYTES) == DISK_BYTES && result[256 + 256 + 4 * 512] == 42);
    assert(cpc_bridge_step(0) == CPC_ERR_INPUT && cpc_bridge_step(20001) == CPC_ERR_INPUT);
    assert(cpc_bridge_key(256, 1) == CPC_ERR_INPUT);
    assert(cpc_bridge_key('A', 1) == CPC_OK);
    assert(cpc_bridge_step(20000) == CPC_OK);
    assert(cpc_bridge_ticks() > 0);
    double ticks = cpc_bridge_ticks();
    uint8_t memory[256];
    assert(cpc_bridge_register(0) == CPC_ERR_STATE);
    assert(cpc_bridge_read_ram(0, memory, 1) == CPC_ERR_STATE);
    assert(cpc_bridge_pause(1) == CPC_OK && !keys['A']);
    assert(cpc_bridge_register(0) >= 0 && cpc_bridge_register(15) == CPC_ERR_INPUT);
    assert(cpc_bridge_read_ram(65535, memory, 2) == CPC_ERR_INPUT);
    assert(cpc_bridge_read_ram(0, memory, 257) == CPC_ERR_INPUT);
    assert(cpc_bridge_read_ram(0, NULL, 1) == CPC_ERR_INPUT);
    /* RAM under ROM and logical bank mapping differ from CPU ROM reads/base RAM. */
    machine.ram[0][0] = 41;
    assert(cpc_bridge_read_ram(0, memory, 1) == 1 && memory[0] == 41 && mem_rd(&machine.mem, 0) == 0xc3);
    for (int config = 0; config < 8; config++) {
        machine.ga.ram_config = (uint8_t)config;
        for (int bank = 0; bank < 8; bank++) machine.ram[bank][0x3fff] = (uint8_t)(80 + bank);
        assert(cpc_bridge_read_ram(0x3fff, memory, 1) == 1 && memory[0] == 80 + _cpc_ram_config[config][0]);
        assert(cpc_bridge_read_ram(0xffff, memory, 1) == 1 && memory[0] == 80 + _cpc_ram_config[config][3]);
        assert(cpc_bridge_read_ram(0x3fff, memory, 2) == 2 && memory[1] == machine.ram[_cpc_ram_config[config][1]][0]);
    }
    machine.ga.ram_config = 0;
    assert(cpc_bridge_step(20000) == CPC_OK && cpc_bridge_ticks() == ticks);
    assert(cpc_bridge_key('A', 1) == CPC_ERR_STATE);
    float samples[AUDIO_CAPACITY]; assert(cpc_bridge_audio(samples, AUDIO_CAPACITY) == 0);
    assert(cpc_bridge_pause(0) == CPC_OK);
    assert(!machine.debug.callback.func);
    assert(cpc_bridge_debug_arm(0, -1, 400000) == CPC_OK);
    assert(cpc_bridge_step(20000) == CPC_OK);
    assert(cpc_bridge_debug_reason() == 1 && paused && z80_opdone(&machine.cpu));
    assert(Z80_GET_ADDR(machine.pins) == 0);
    assert(cpc_bridge_ticks() - ticks < 80000 && cpc_bridge_ticks() > ticks);
    const double stopped_ticks = cpc_bridge_ticks();
    const uint64_t stopped_keyboard_time = machine.kbd.cur_time;
    assert(cpc_bridge_step(20000) == CPC_OK && cpc_bridge_ticks() == stopped_ticks);
    assert(cpc_bridge_pause(0) == CPC_OK && !machine.debug.callback.func);
    assert(cpc_bridge_debug_arm(1, -1, 23) == CPC_OK);
    assert(cpc_bridge_step(20000) == CPC_OK && cpc_bridge_debug_reason() == 2);
    assert(cpc_bridge_ticks() - stopped_ticks == 23);
    assert(machine.kbd.cur_time - stopped_keyboard_time == 5);
    assert(cpc_bridge_debug_cancel() == CPC_OK && !machine.debug.callback.func && paused);
    assert(cpc_bridge_debug_arm(0, 0, 5) == CPC_ERR_INPUT);
    assert(cpc_bridge_debug_arm(0, -1, 40000001) == CPC_ERR_INPUT);
    assert(cpc_bridge_pause(0) == CPC_OK);
    for (int i = 0; i < 10; i++) assert(cpc_bridge_step(20000) == CPC_OK);
    int count = cpc_bridge_audio(samples, AUDIO_CAPACITY); assert(count > 0 && count <= AUDIO_CAPACITY);
    assert(cpc_bridge_frame() && cpc_bridge_palette());
    assert(cpc_bridge_reset() == CPC_OK && cpc_bridge_ticks() == 0);
    assert(!machine.debug.callback.func && cpc_bridge_debug_reason() == 0);
    assert(cpc_bridge_export(result, DISK_BYTES) == DISK_BYTES && result[256 + 256 + 4 * 512] == 42);
    cpc_bridge_dispose(); cpc_bridge_dispose();
    assert(cpc_bridge_export(result, DISK_BYTES) == CPC_ERR_STATE);
    free(result); free(disk);
    puts("PASS: native bridge, synthetic execution, bounded input, pause/audio and drive-write export. CPC boot NOT tested.");
    return 0;
}
