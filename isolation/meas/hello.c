#include <stdio.h>
#include <unistd.h>
#include <dirent.h>
int main(void){
  char h[64]; gethostname(h,sizeof h);
  printf("pid=%d uid=%d hostname=%s\n", getpid(), getuid(), h);
  DIR*d=opendir("/"); struct dirent*e; int n=0; while((e=readdir(d))) n++; closedir(d);
  printf("entries in / : %d\n", n);
  return 0;
}
