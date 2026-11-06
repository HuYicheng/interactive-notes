#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
static double now(){struct timespec t;clock_gettime(CLOCK_MONOTONIC,&t);return t.tv_sec+t.tv_nsec*1e-9;}
int main(int c,char**v){
  if(c>1 && v[1][0]=='c'){ double t=now(); volatile double s=0; for(long i=0;i<400000000L;i++) s+=i*0.5; printf("cpu loop wall %.2f s\n", now()-t); return 0;}
  for(int mb=16;mb<=512;mb+=16){ char*p=malloc(16<<20); memset(p,1,16<<20); printf("allocated %d MiB\n",mb); fflush(stdout);} return 0;}
