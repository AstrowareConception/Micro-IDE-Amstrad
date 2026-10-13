/* Original codec qualification. ROMs supplied by caller, never distributed. */
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include "../packages/emulator/src/cpc_bridge.c"
static void load(const char *path,uint8_t *buffer,int size){FILE *f=fopen(path,"rb");assert(f);assert(fread(buffer,1,size,f)==(size_t)size);assert(fgetc(f)==EOF);fclose(f);}
static void type(const char *text){for(const char *p=text;*p;p++){cpc_bridge_key(*p,1);for(int i=0;i<6;i++)cpc_bridge_step(10000);cpc_bridge_key(*p,0);for(int i=0;i<6;i++)cpc_bridge_step(10000);}}
int main(int argc,char **argv){
 assert(argc==7);uint8_t os[16384],basic[16384],amsdos[16384];uint8_t *disk=malloc(DISK_BYTES);assert(disk);
 load(argv[1],os,16384);load(argv[2],basic,16384);load(argv[3],amsdos,16384);load(argv[4],disk,DISK_BYTES);
 assert(cpc_bridge_init(os,16384,basic,16384,amsdos,16384)==CPC_OK);
 for(int i=0;i<250;i++)cpc_bridge_step(20000);
 assert(cpc_bridge_mount(disk,DISK_BYTES)==CPC_OK);type("RUN\"MAIN.BAS\"\r");
 for(int i=0;i<650;i++)cpc_bridge_step(20000);
 if(atoi(argv[6])){type("SAVE\"ROUND\",P\r");for(int i=0;i<400;i++)cpc_bridge_step(20000);type("SAVE\"ASCII\",A\r");for(int i=0;i<400;i++)cpc_bridge_step(20000);}
 assert(cpc_bridge_export(disk,DISK_BYTES)==DISK_BYTES);
 FILE *out=fopen(argv[5],"wb");assert(out);assert(fwrite(disk,1,DISK_BYTES,out)==DISK_BYTES);fclose(out);
 cpc_bridge_dispose();free(disk);return 0;
}
