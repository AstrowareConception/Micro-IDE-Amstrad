/* Original qualification harness. ROMs are explicit local test inputs, never embedded. */
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include "../packages/emulator/src/cpc_bridge.c"
static int word(int address) { return cpc_bridge_peek(address) | (cpc_bridge_peek(address + 1) << 8); }
static void load(const char* path, uint8_t* bytes, int length) {
    FILE* file = fopen(path, "rb"); assert(file);
    assert((int)fread(bytes, 1, (size_t)length, file) == length && fgetc(file) == EOF);
    fclose(file);
}
static void run_until_stop(void) {
    for (int i = 0; i < 501 && !cpc_bridge_debug_reason(); i++) assert(cpc_bridge_step(20000) == CPC_OK);
    assert(cpc_bridge_debug_reason() == 1);
    assert(paused && z80_opdone(&machine.cpu) && Z80_GET_ADDR(machine.pins) == 0xde60);
    assert(machine.ga.rom_select == 0 && !(machine.ga.regs.config & AM40010_CONFIG_HROMEN));
}
int main(int argc, char** argv) {
    assert(argc == 5);
    uint8_t os[16384], basic[16384], amsdos[16384];
    uint8_t* disk = malloc(DISK_BYTES); assert(disk);
    load(argv[1], os, 16384); load(argv[2], basic, 16384); load(argv[3], amsdos, 16384); load(argv[4], disk, DISK_BYTES);
    assert(cpc_bridge_init(os, 16384, basic, 16384, amsdos, 16384) == CPC_OK);
    for (int i = 0; i < 250; i++) cpc_bridge_step(20000);
    assert(cpc_bridge_mount(disk, DISK_BYTES) == CPC_OK);
    const char* command = "RUN\"MAIN.BAS\"";
    for (const char* p = command; *p; p++) {
        cpc_bridge_key(*p, 1); for (int i = 0; i < 6; i++) cpc_bridge_step(10000);
        cpc_bridge_key(*p, 0); for (int i = 0; i < 6; i++) cpc_bridge_step(10000);
    }
    cpc_bridge_key(13, 1);
    const int lines[] = {10, 20, 20, 30, 100, 110, 40, 60, 70};
    const int markers[] = {0, 0, 11, 22, 22, 33, 33, 33, 44};
    int observed = 0, direct = 0;
    puts("{\"profile\":\"cpc6128-english-basic11\",\"boundary\":\"DE60-opcode-fetch\",\"observations\":[");
    while (observed < 9) {
        cpc_bridge_pause(0);
        assert(cpc_bridge_debug_arm(0xde60, 0, 40000000) == CPC_OK);
        run_until_stop();
        assert(machine.ga.ram_config == 0);
        const int line_pointer = word(0xae1d);
        if (!line_pointer) { assert(++direct < 4); continue; }
        const int line = word(line_pointer), statement = cpc_bridge_register(5);
        assert(line == lines[observed]);
        /* Validate against the actual tokenised listing loaded by the ROM. */
        /* AE64 points to the byte immediately before the first line-length word. */
        int record = word(0xae64) + 1, end = word(0xae66), found = 0;
        assert(record >= 0x100 && end < 0xac00);
        for (int count = 0; count < 1000 && record < end; count++) {
            const int length = word(record);
            if (!length) break;
            if (length < 5 || record + length > end) {
                fprintf(stderr, "Invalid tokenised record: start=%04x end=%04x record=%04x length=%04x linePointer=%04x HL=%04x line=%d\n", word(0xae64), end, record, length, line_pointer, statement, line);
                for (int p = record - 2; p < record + 18; p++) fprintf(stderr, "%04x:%02x ", p, cpc_bridge_peek(p));
                fputc('\n', stderr);
            }
            assert(length >= 5 && record + length <= end);
            if (record + 2 == line_pointer) {
                assert(statement >= line_pointer + 1 && statement < record + length);
                found = 1; break;
            }
            record += length;
        }
        assert(found);
        assert(cpc_bridge_peek(0x8000) == markers[observed]);
        const double ticks = cpc_bridge_ticks();
        for (int i = 0; i < 3; i++) cpc_bridge_step(20000);
        assert(cpc_bridge_ticks() == ticks);
        printf("%s{\"line\":%d,\"linePointer\":%d,\"statementPointer\":%d,\"marker\":%d,\"ticks\":%.0f}", observed ? ",\n" : "", line, line_pointer, statement, markers[observed], ticks);
        observed++;
    }
    cpc_bridge_pause(0); assert(!machine.debug.callback.func);
    for (int i = 0; i < 100; i++) cpc_bridge_step(20000);
    assert(cpc_bridge_peek(0x8000) == 44);
    puts("\n],\"resumeWithoutHook\":true,\"variablesQualified\":false,\"timersQualified\":false,\"inputQualified\":false}");
    cpc_bridge_dispose(); free(disk); return 0;
}
