/* Original project adapter. Upstream chips headers remain unmodified. */
#include "cpc_bridge.h"
#include <string.h>
#define CHIPS_IMPL
#include "chips/chips_common.h"
#include "chips/z80.h"
#include "chips/ay38910.h"
#include "chips/i8255.h"
#include "chips/mc6845.h"
#include "chips/am40010.h"
#include "chips/upd765.h"
#include "chips/mem.h"
#include "chips/kbd.h"
#include "chips/clk.h"
#include "chips/fdd.h"
#include "chips/fdd_cpc.h"
#include "systems/cpc.h"

#define DISK_BYTES 194816
#define AUDIO_CAPACITY 4096
static cpc_t machine;
static uint8_t disk_template[DISK_BYTES];
static float audio_ring[AUDIO_CAPACITY];
static int audio_start, audio_count;
static bool live, paused, keys[256];
static uint64_t elapsed_ticks;
static bool debug_stopped;
static int debug_address, debug_rom, debug_budget, debug_reason;
static uint64_t debug_ticks;

static void debug_callback(void* unused, uint64_t pins) {
    (void)unused;
    debug_ticks++;
    const bool mapping = debug_rom == -1 ||
        (!(machine.ga.regs.config & AM40010_CONFIG_HROMEN) && machine.ga.rom_select == debug_rom);
    if (mapping && z80_opdone(&machine.cpu) && Z80_GET_ADDR(pins) == debug_address) {
        debug_reason = 1; debug_stopped = true;
    } else if (--debug_budget == 0) {
        debug_reason = 2; debug_stopped = true;
    }
}

static void clear_debug(void) {
    machine.debug = (chips_debug_t){0};
    debug_stopped = false; debug_reason = 0; debug_ticks = 0;
}

/* Strict whitelist before the upstream parser: standard DATA only in J0. */
static bool valid_disk(const uint8_t* bytes, int size) {
    if (!bytes || size != DISK_BYTES || memcmp(bytes, "MV - CPCEMU Disk-File\r\nDisk-Info\r\n", 34) ||
        bytes[0x30] != 40 || bytes[0x31] != 1 || bytes[0x32] != 0 || bytes[0x33] != 0x13) return false;
    for (int track = 0; track < 40; track++) {
        const uint8_t* header = bytes + 256 + track * 4864;
        if (memcmp(header, "Track-Info\r\n", 12) || header[16] != track || header[17] != 0 ||
            header[20] != 2 || header[21] != 9) return false;
        unsigned seen = 0;
        for (int index = 0; index < 9; index++) {
            const uint8_t* sector = header + 24 + index * 8;
            if (sector[0] != track || sector[1] != 0 || sector[2] < 0xc1 || sector[2] > 0xc9 ||
                sector[3] != 2 || sector[4] || sector[5]) return false;
            unsigned mask = 1u << (sector[2] - 0xc1);
            if (seen & mask) return false;
            seen |= mask;
        }
    }
    return true;
}

static void audio_callback(const float* samples, int count, void* unused) {
    (void)unused;
    for (int i = 0; i < count; i++) {
        if (audio_count == AUDIO_CAPACITY) {
            audio_start = (audio_start + 1) % AUDIO_CAPACITY;
            audio_count--;
        }
        audio_ring[(audio_start + audio_count++) % AUDIO_CAPACITY] = samples[i];
    }
}

void cpc_bridge_release_keys(void) {
    if (!live) return;
    for (int key = 0; key < 256; key++) if (keys[key]) cpc_key_up(&machine, key);
    memset(keys, 0, sizeof(keys));
    cpc_joystick(&machine, 0);
}

void cpc_bridge_dispose(void) {
    if (live) { cpc_bridge_release_keys(); cpc_discard(&machine); }
    live = false; paused = false; audio_start = audio_count = 0; elapsed_ticks = 0;
    clear_debug();
    memset(disk_template, 0, sizeof(disk_template));
}

int cpc_bridge_init(const uint8_t* os, int os_size, const uint8_t* basic, int basic_size,
                    const uint8_t* amsdos, int amsdos_size) {
    if (!os || !basic || !amsdos || os_size != 16384 || basic_size != 16384 || amsdos_size != 16384) return CPC_ERR_INPUT;
    cpc_bridge_dispose();
    cpc_desc_t desc = { .type = CPC_TYPE_6128, .joystick_type = CPC_JOYSTICK_NONE,
        .audio = { .callback = { .func = audio_callback }, .num_samples = 128, .sample_rate = 44100 },
        /* chips_range_t uses void*: cpc_init copies these inputs without modifying them. */
        .roms.cpc6128 = { .os = { (void*)os, 16384 }, .basic = { (void*)basic, 16384 }, .amsdos = { (void*)amsdos, 16384 } } };
    cpc_init(&machine, &desc); live = true;
    return CPC_OK;
}

int cpc_bridge_mount(const uint8_t* bytes, int size) {
    if (!live) return CPC_ERR_STATE;
    if (!valid_disk(bytes, size)) return CPC_ERR_DISK;
    if (!cpc_insert_disc(&machine, (chips_range_t){ (void*)bytes, (size_t)size })) return CPC_ERR_DISK;
    memcpy(disk_template, bytes, DISK_BYTES);
    return CPC_OK;
}

int cpc_bridge_export(uint8_t* output, int capacity) {
    if (!live || !machine.fdd.has_disc) return CPC_ERR_STATE;
    if (!output || capacity < DISK_BYTES) return CPC_ERR_INPUT;
    /* Preserve topology, copy the mutable drive sector data, never source files. */
    if (machine.fdd.disc.num_tracks != 40 || machine.fdd.disc.num_sides != 1) return CPC_ERR_DISK;
    memcpy(output, disk_template, DISK_BYTES);
    for (int track = 0; track < 40; track++) {
        const fdd_track_t* stored = &machine.fdd.disc.tracks[0][track];
        if (stored->num_sectors != 9) return CPC_ERR_DISK;
        for (int index = 0; index < 9; index++) {
            const fdd_sector_t* sector = &stored->sectors[index];
            int descriptor = 256 + track * 4864 + 24 + index * 8;
            if (sector->data_size != 512 || sector->data_offset < 0 ||
                sector->data_offset > machine.fdd.data_size - 512 ||
                sector->info.upd765.r != disk_template[descriptor + 2]) return CPC_ERR_DISK;
            memcpy(output + 256 + track * 4864 + 256 + index * 512,
                machine.fdd.data + sector->data_offset, 512);
        }
    }
    return DISK_BYTES;
}

int cpc_bridge_step(int microseconds) {
    if (!live) return CPC_ERR_STATE;
    if (microseconds < 1 || microseconds > 20000) return CPC_ERR_INPUT;
    if (!paused) {
        /* Upstream cpc_exec returns requested ticks even when its hook stops early. */
        const bool hooked = machine.debug.callback.func != NULL;
        const uint64_t before = debug_ticks;
        const uint64_t keyboard_time = machine.kbd.cur_time;
        const uint32_t requested = cpc_exec(&machine, (uint32_t)microseconds);
        elapsed_ticks += hooked ? debug_ticks - before : requested;
        /* The pinned upstream also advances its keyboard clock by the request. */
        if (hooked) machine.kbd.cur_time = keyboard_time + (debug_ticks - before) / 4;
        if (debug_stopped) {
            paused = true; cpc_bridge_release_keys(); audio_start = audio_count = 0;
        }
    }
    return CPC_OK;
}
int cpc_bridge_pause(int state) {
    if (!live) return CPC_ERR_STATE;
    if (state != 0 && state != 1) return CPC_ERR_INPUT;
    paused = state != 0; cpc_bridge_release_keys(); audio_start = audio_count = 0;
    if (!paused) clear_debug();
    return CPC_OK;
}
int cpc_bridge_reset(void) {
    if (!live) return CPC_ERR_STATE;
    cpc_bridge_release_keys(); clear_debug(); cpc_reset(&machine); audio_start = audio_count = 0; elapsed_ticks = 0;
    return CPC_OK;
}
int cpc_bridge_key(int key, int down) {
    if (!live) return CPC_ERR_STATE;
    if (key < 0 || key > 255 || (down != 0 && down != 1)) return CPC_ERR_INPUT;
    if (paused && down) return CPC_ERR_STATE;
    if (down) cpc_key_down(&machine, key); else cpc_key_up(&machine, key);
    keys[key] = down != 0;
    return CPC_OK;
}
int cpc_bridge_joystick(int mask) {
    if (!live || paused) return CPC_ERR_STATE;
    if (mask < 0 || mask > 31) return CPC_ERR_INPUT;
    cpc_set_joystick_type(&machine, CPC_JOYSTICK_DIGITAL); cpc_joystick(&machine, (uint8_t)mask);
    return CPC_OK;
}
int cpc_bridge_audio(float* output, int capacity) {
    if (!live) return CPC_ERR_STATE;
    if (!output || capacity < 1 || capacity > AUDIO_CAPACITY) return CPC_ERR_INPUT;
    int count = audio_count < capacity ? audio_count : capacity;
    for (int i = 0; i < count; i++) { output[i] = audio_ring[audio_start]; audio_start = (audio_start + 1) % AUDIO_CAPACITY; }
    audio_count -= count; return count;
}
const uint8_t* cpc_bridge_frame(void) { return live ? machine.fb : NULL; }
const uint32_t* cpc_bridge_palette(void) { return live ? machine.ga.hw_colors : NULL; }
int cpc_bridge_width(void) { return cpc_display_info(NULL).screen.width; }
int cpc_bridge_height(void) { return cpc_display_info(NULL).screen.height; }
int cpc_bridge_stride(void) { return cpc_display_info(NULL).frame.dim.width; }
double cpc_bridge_ticks(void) { return (double)elapsed_ticks; }
int cpc_bridge_peek(int address) {
    if (!live) return CPC_ERR_STATE;
    if (address < 0 || address > 65535) return CPC_ERR_INPUT;
    return machine.ram[address >> 14][address & 0x3fff];
}

int cpc_bridge_register(int index) {
    if (!live || !paused) return CPC_ERR_STATE;
    const int values[] = { machine.cpu.pc, machine.cpu.sp, machine.cpu.af, machine.cpu.bc,
        machine.cpu.de, machine.cpu.hl, machine.cpu.ix, machine.cpu.iy, machine.cpu.af2,
        machine.cpu.bc2, machine.cpu.de2, machine.cpu.hl2, machine.ga.ram_config,
        machine.ga.rom_select, machine.ga.regs.config };
    if (index < 0 || index >= (int)(sizeof(values) / sizeof(values[0]))) return CPC_ERR_INPUT;
    return values[index];
}

int cpc_bridge_read_ram(int address, uint8_t* output, int length) {
    if (!live || !paused) return CPC_ERR_STATE;
    if (!output || address < 0 || address > 65535 || length < 1 || length > 256 ||
        length > 65536 - address) return CPC_ERR_INPUT;
    const int* banks = _cpc_ram_config[machine.ga.ram_config & 7];
    for (int i = 0; i < length; i++) {
        const int logical = address + i;
        output[i] = machine.ram[banks[logical >> 14]][logical & 0x3fff];
    }
    return length;
}

int cpc_bridge_debug_arm(int address, int upper_rom, int tick_budget) {
    if (!live) return CPC_ERR_STATE;
    if (address < 0 || address > 65535 || (upper_rom != -1 && upper_rom != 0 && upper_rom != 7) ||
        (upper_rom != -1 && address < 0xc000) || tick_budget < 1 || tick_budget > 40000000) return CPC_ERR_INPUT;
    clear_debug(); debug_address = address; debug_rom = upper_rom; debug_budget = tick_budget;
    machine.debug = (chips_debug_t){ .callback.func = debug_callback, .stopped = &debug_stopped };
    return CPC_OK;
}
int cpc_bridge_debug_cancel(void) {
    if (!live) return CPC_ERR_STATE;
    clear_debug(); return CPC_OK;
}
int cpc_bridge_debug_reason(void) { return live ? debug_reason : CPC_ERR_STATE; }
