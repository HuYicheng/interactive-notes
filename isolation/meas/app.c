#include <stdio.h>
#include <fcntl.h>
#include <time.h>
#include <unistd.h>
#include <sys/stat.h>
static double now(){struct timespec t;clock_gettime(CLOCK_MONOTONIC,&t);return t.tv_sec+t.tv_nsec*1e-9;}
int main(int c,char**v){
  const char*p=c>1?v[1]:"/big.bin";
  for(int k=0;k<3;k++){double t=now(); int fd=open(p,O_WRONLY|O_APPEND); write(fd,"x",1); close(fd);
   printf("write #%d to %s: %.2f ms\n",k+1,p,(now()-t)*1e3);}
  double t=now(); int fd=open("/new.txt",O_WRONLY|O_CREAT,0644); write(fd,"x",1); close(fd);
  printf("create small new file: %.3f ms\n",(now()-t)*1e3);
  return 0;
}
