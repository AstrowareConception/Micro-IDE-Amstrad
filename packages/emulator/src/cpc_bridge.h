#pragma once
#include <stdint.h>

enum { CPC_OK = 0, CPC_ERR_INPUT = -1, CPC_ERR_STATE = -2, CPC_ERR_DISK = -3 };
int cpc_bridge_init(const uint8_t* os, int os_size, const uint8_t* basic, int basic_size,
                    const uint8_t* amsdos, int amsdos_size);
void cpc_bridge_dispose(void);
int cpc_bridge_mount(const uint8_t* bytes, int size);
int cpc_bridge_export(uint8_t* output, int capacity);
int cpc_bridge_step(int microseconds);
int cpc_bridge_pause(int paused);
int cpc_bridge_reset(void);
int cpc_bridge_key(int key, int down);
void cpc_bridge_release_keys(void);
int cpc_bridge_joystick(int mask);
int cpc_bridge_audio(float* output, int capacity);
const uint8_t* cpc_bridge_frame(void);
const uint32_t* cpc_bridge_palette(void);
int cpc_bridge_width(void);
int cpc_bridge_height(void);
int cpc_bridge_stride(void);
double cpc_bridge_ticks(void);
int cpc_bridge_peek(int address);
