// msg.c — decode a small JointState-like message (7 joints: names + position/velocity/effort) from bytes into a C struct,
// and copy one 1280x720 RGB image (2,764,800 bytes). Average time per operation. Build: gcc -O2 -o msg msg.c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <time.h>
typedef struct { int32_t sec; uint32_t nsec; char name[7][8]; double pos[7], vel[7], eff[7]; } JointState;
static double now(void){struct timespec t;clock_gettime(CLOCK_MONOTONIC,&t);return t.tv_sec+t.tv_nsec*1e-9;}
int main(void){
  // wire format: sec, nsec, 7 names of 8 bytes, then 21 float64
  unsigned char wire[8+56+168]; for(size_t i=0;i<sizeof wire;i++) wire[i]=(unsigned char)i;
  JointState js; volatile double sink=0; long N=20000000;
  double t0=now();
  for(long i=0;i<N;i++){ wire[0]=(unsigned char)i;
    memcpy(&js.sec,wire,4); memcpy(&js.nsec,wire+4,4); memcpy(js.name,wire+8,56);
    memcpy(js.pos,wire+64,56); memcpy(js.vel,wire+120,56); memcpy(js.eff,wire+176,56);
    sink+=js.pos[3]+js.sec; }
  double t1=now();
  printf("C decode JointState (7 joints): %.1f ns per message\n",(t1-t0)/N*1e9);
  size_t S=2764800; char*a=malloc(S),*b=malloc(S); memset(a,3,S); memset(b,0,S); int M=400;
  t0=now(); for(int i=0;i<M;i++){a[0]=(char)i; memcpy(b,a,S); sink+=b[i];} t1=now();
  printf("C copy one 1280x720 RGB image (2,764,800 B): %.1f us\n",(t1-t0)/M*1e6);
  return (int)(sink<0);
}
