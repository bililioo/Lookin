//
//  LKConnectionRequest.m
//  Lookin
//
//  Created by Li Kai on 2019/6/24.
//  https://lookin.work
//

#import "LKConnectionRequest.h"

@interface LKConnectionRequest ()

@property(nonatomic, strong) dispatch_source_t timeoutTimer;

@end

@implementation LKConnectionRequest

- (void)resetTimeoutCount {
    [self endTimeoutCount];
    if (self.timeoutInterval > 0) {
        dispatch_source_t timer = dispatch_source_create(DISPATCH_SOURCE_TYPE_TIMER, 0, 0, dispatch_get_main_queue());
        self.timeoutTimer = timer;
        dispatch_source_set_timer(timer, dispatch_time(DISPATCH_TIME_NOW, (int64_t)(self.timeoutInterval * NSEC_PER_SEC)), DISPATCH_TIME_FOREVER, (uint64_t)(0.1 * NSEC_PER_SEC));
        @weakify(self);
        dispatch_source_set_event_handler(timer, ^{
            @strongify(self);
            [self endTimeoutCount];
            [self _handleTimeout];
        });
        dispatch_resume(timer);
    } else {
        NSAssert(NO, @"timeoutInterval 为 0");
    }
}

- (void)endTimeoutCount {
    if (self.timeoutTimer) {
        dispatch_source_cancel(self.timeoutTimer);
        self.timeoutTimer = nil;
    }
}

- (void)_handleTimeout {
    if (self.timeoutBlock) {
        self.timeoutBlock(self);
    }
}

@end
